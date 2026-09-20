import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { rematchInvoicesForPo } from "@/lib/invoicing";

export type Result = { status: number; json: unknown };
export const RECEIVABLE = ["SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED"];
const num = (d: { toString(): string } | null | undefined) => (d == null ? 0 : Number(d.toString()));
const c = (n: number) => Math.round(n * 100);
const dec = (cents: number) => (cents / 100).toFixed(2); // exact decimal string for Prisma

class ConflictError extends Error {}

export async function nextReceiptNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.goodsReceipt.count({ where: { organizationId, receiptNumber: { startsWith: `GR-${year}-` } } });
  return `GR-${year}-${String(count + 1).padStart(5, "0")}`;
}

export type ReceiptLineInput = { poLineId: string; accepted: number; rejected?: number; reason?: string };

/**
 * Records what actually arrived against a purchase order. Accepted goods count as received (and
 * become invoiceable); rejected goods are recorded with a reason but never counted. The received
 * quantity can never exceed what was ordered, even if two people post a receipt at the same moment:
 * each line is advanced with a conditional update inside a transaction, and a losing race rolls the
 * whole receipt back.
 */
export async function postReceipt(opts: {
  organizationId: string; actor: { id: string; name: string }; purchaseOrderId: string;
  lines: ReceiptLineInput[]; deliveryNote?: string; notes?: string; receivedAt?: Date;
}): Promise<Result> {
  const po = await prisma.purchaseOrder.findFirst({ where: { id: opts.purchaseOrderId, organizationId: opts.organizationId }, include: { lineItems: true } });
  if (!po) return { status: 404, json: { error: "Not found" } };
  if (!RECEIVABLE.includes(po.status)) return { status: 422, json: { error: po.status === "RECEIVED" ? "Everything on this purchase order has already been received." : `Goods can only be received against an issued purchase order. This one is ${po.status.toLowerCase()}.` } };

  const byId = new Map(po.lineItems.map(l => [l.id, l]));
  const seen = new Set<string>();
  const lines = opts.lines.filter(l => (l.accepted ?? 0) > 0 || (l.rejected ?? 0) > 0);
  if (lines.length === 0) return { status: 422, json: { error: "Enter a quantity for at least one line" } };
  for (const l of lines) {
    const pl = byId.get(l.poLineId);
    if (!pl) return { status: 422, json: { error: "One of the lines isn't on this purchase order" } };
    if (seen.has(l.poLineId)) return { status: 422, json: { error: "A line appears twice" } };
    seen.add(l.poLineId);
    if (!Number.isFinite(l.accepted) || l.accepted < 0 || (l.rejected ?? 0) < 0) return { status: 422, json: { error: "Quantities can't be negative" } };
    if ((l.rejected ?? 0) > 0 && !(l.reason ?? "").trim()) return { status: 422, json: { error: `Say why "${pl.description}" was rejected` } };
    const remaining = c(num(pl.quantity)) - c(num(pl.receivedQty));
    if (c(l.accepted) > remaining) return { status: 422, json: { error: `"${pl.description}": you're accepting ${l.accepted} but only ${remaining / 100} is still outstanding (ordered ${num(pl.quantity)}, already received ${num(pl.receivedQty)}).` } };
  }

  let receipt;
  try {
    // The receipt number comes from a count, so two simultaneous receipts can pick the same one. That
    // collision is harmless and unrelated to the goods, so it's retried rather than shown to the user.
    for (let attempt = 0; ; attempt++) {
      try {
    receipt = await prisma.$transaction(async tx => {
      const number = await nextReceiptNumber(opts.organizationId);
      const created = await tx.goodsReceipt.create({
        data: {
          organizationId: opts.organizationId, receiptNumber: number, purchaseOrderId: po.id, receivedById: opts.actor.id,
          receivedAt: opts.receivedAt ?? new Date(), deliveryNote: opts.deliveryNote?.trim() || null, notes: opts.notes?.trim() || null,
          lines: { create: lines.map(l => ({ poLineId: l.poLineId, quantityAccepted: dec(c(l.accepted)), quantityRejected: dec(c(l.rejected ?? 0)), rejectionReason: (l.rejected ?? 0) > 0 ? l.reason!.trim() : null })) },
        },
      });
      for (const l of lines) {
        if (c(l.accepted) === 0) continue;
        const ordered = c(num(byId.get(l.poLineId)!.quantity));
        // Only advance if there's still room *right now* — this is what makes concurrent receipts safe.
        const advanced = await tx.purchaseOrderLineItem.updateMany({
          where: { id: l.poLineId, purchaseOrderId: po.id, receivedQty: { lte: dec(ordered - c(l.accepted)) } },
          data: { receivedQty: { increment: dec(c(l.accepted)) } },
        });
        if (advanced.count === 0) throw new ConflictError();
      }
      const now = await tx.purchaseOrderLineItem.findMany({ where: { purchaseOrderId: po.id }, select: { quantity: true, receivedQty: true } });
      const complete = now.every(l => c(num(l.receivedQty)) >= c(num(l.quantity)));
      const any = now.some(l => c(num(l.receivedQty)) > 0);
      await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: complete ? "RECEIVED" : any ? "PARTIALLY_RECEIVED" : po.status } });
      return { ...created, poStatus: complete ? "RECEIVED" : any ? "PARTIALLY_RECEIVED" : po.status };
    });
        break;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 4) { await new Promise(r => setTimeout(r, 20 + Math.random() * 60)); continue; }
        throw e;
      }
    }
  } catch (e) {
    if (e instanceof ConflictError) return { status: 409, json: { error: "Someone else just recorded a receipt for this order and it would now exceed the quantity ordered. Reload to see the latest figures." } };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { status: 409, json: { error: "Please try again — that receipt number was just taken." } };
    throw e;
  }

  await logAudit({ organizationId: opts.organizationId, userId: opts.actor.id, userName: opts.actor.name, action: "CREATED", entity: "GOODS_RECEIPT", entityId: receipt.id, entityLabel: `${receipt.receiptNumber} for ${po.poNumber}`, details: { lines: lines.length, poStatus: receipt.poStatus } });
  // Newly received goods may clear invoices that were held as "not received".
  const rematch = await rematchInvoicesForPo(po.id);
  return { status: 201, json: { receipt, poStatus: receipt.poStatus, invoicesRechecked: rematch.checked, invoicesNowClear: rematch.nowClear } };
}

/** Whether this person may record goods against the PO: procurement/admin, or whoever ordered it. */
export async function mayReceive(actor: { id: string; role: string }, po: { createdById: string; requisitionId: string | null }): Promise<boolean> {
  if (actor.role === "ADMIN" || actor.role === "PROCUREMENT") return true;
  if (po.createdById === actor.id) return true;
  if (!po.requisitionId) return false;
  const req = await prisma.requisition.findUnique({ where: { id: po.requisitionId }, select: { requestorId: true } });
  return req?.requestorId === actor.id;
}
