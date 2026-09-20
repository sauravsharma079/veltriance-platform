import { Prisma } from "@prisma/client";
import type { Invoice } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { threeWayMatch, type MatchResult } from "@/lib/invoice-match";

export type Result = { status: number; json: unknown };
const num = (d: { toString(): string } | number | null | undefined) => (d == null ? 0 : Number(d.toString()));
const LIVE = ["RECEIVED", "MATCHED", "EXCEPTION", "APPROVED", "PAID"] as const; // everything except REJECTED

export async function nextInvoiceNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.invoice.count({ where: { organizationId, internalNumber: { startsWith: `INV-${year}-` } } });
  return `INV-${year}-${String(count + 1).padStart(5, "0")}`;
}

/** For each PO line: ordered, accepted-received, already invoiced, and what can still be invoiced. */
export async function invoiceableSummary(purchaseOrderId: string, excludeInvoiceId?: string) {
  const [po, billed] = await Promise.all([
    prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, include: { lineItems: { orderBy: { createdAt: "asc" } } } }),
    prisma.invoiceLine.groupBy({ by: ["poLineId"], where: { poLineId: { not: null }, invoice: { purchaseOrderId, status: { in: [...LIVE] }, ...(excludeInvoiceId && { id: { not: excludeInvoiceId } }) } }, _sum: { quantity: true } }),
  ]);
  if (!po) return null;
  const billedBy = new Map(billed.map(b => [b.poLineId!, num(b._sum.quantity)]));
  return {
    po,
    lines: po.lineItems.map(l => {
      const received = num(l.receivedQty), invoiced = billedBy.get(l.id) ?? 0;
      return { id: l.id, description: l.description, unit: l.unit, ordered: num(l.quantity), unitPrice: num(l.unitPrice), received, invoiced, invoiceable: Math.max(0, Math.round((received - invoiced) * 100) / 100) };
    }),
  };
}

/** Runs the three-way match and stores the result; a clean match is approved automatically if the org allows it. */
export async function matchInvoice(invoiceId: string): Promise<{ invoice: Invoice; result: MatchResult; autoApproved: boolean } | null> {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { lines: true, supplier: { select: { status: true } }, organization: { select: { matchPriceTolerancePct: true, matchQtyTolerancePct: true, invoiceAutoApprove: true } } } });
  if (!inv) return null;
  const summary = inv.purchaseOrderId ? await invoiceableSummary(inv.purchaseOrderId, inv.id) : null;
  const similar = inv.purchaseOrderId ? await prisma.invoice.findMany({
    where: { organizationId: inv.organizationId, supplierId: inv.supplierId, purchaseOrderId: inv.purchaseOrderId, id: { not: inv.id }, status: { in: [...LIVE] }, totalAmount: inv.totalAmount, invoiceNumber: { not: inv.invoiceNumber } },
    select: { invoiceNumber: true },
  }) : [];

  const result = threeWayMatch({
    invoice: { supplierId: inv.supplierId, currency: inv.currency, invoiceDate: inv.invoiceDate, subtotal: num(inv.subtotal), taxAmount: num(inv.taxAmount), totalAmount: num(inv.totalAmount), lines: inv.lines.map(l => ({ poLineId: l.poLineId, description: l.description, quantity: num(l.quantity), unitPrice: num(l.unitPrice), lineTotal: num(l.lineTotal) })) },
    po: summary ? { supplierId: summary.po.supplierId, currency: summary.po.currency, status: summary.po.status, lines: summary.lines.map(l => ({ id: l.id, description: l.description, quantity: l.ordered, unitPrice: l.unitPrice, receivedQty: l.received })) } : null,
    invoicedElsewhere: Object.fromEntries((summary?.lines ?? []).map(l => [l.id, l.invoiced])),
    similarInvoices: similar, supplierStatus: inv.supplier.status,
    tolerances: { pricePct: inv.organization.matchPriceTolerancePct, qtyPct: inv.organization.matchQtyTolerancePct },
  });

  // Only an invoice still awaiting a decision is re-matched; approved, rejected and paid ones are final.
  const auto = result.status === "MATCHED" && inv.organization.invoiceAutoApprove;
  const moved = await prisma.invoice.updateMany({
    where: { id: inv.id, status: { in: ["RECEIVED", "MATCHED", "EXCEPTION"] } },
    data: { status: auto ? "APPROVED" : result.status, matchResult: result as unknown as Prisma.InputJsonValue, ...(auto && { approvedAt: new Date(), approvedById: null, approvalNote: "Approved automatically: clean three-way match" }) },
  });
  if (moved.count > 0 && auto) await logAudit({ organizationId: inv.organizationId, userName: "Auto-match", action: "APPROVED", entity: "INVOICE", entityId: inv.id, entityLabel: `${inv.internalNumber} (${inv.invoiceNumber})`, details: { auto: true } });
  const fresh = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
  return { invoice: fresh, result, autoApproved: moved.count > 0 && auto };
}

/** New goods arriving can turn an exception into a clean match — re-check what was waiting on this PO. */
export async function rematchInvoicesForPo(purchaseOrderId: string): Promise<{ checked: number; nowClear: number }> {
  const waiting = await prisma.invoice.findMany({ where: { purchaseOrderId, status: { in: ["RECEIVED", "MATCHED", "EXCEPTION"] } }, select: { id: true, status: true } });
  let nowClear = 0;
  for (const w of waiting) {
    const r = await matchInvoice(w.id);
    if (r && w.status === "EXCEPTION" && r.result.status === "MATCHED") nowClear++;
  }
  return { checked: waiting.length, nowClear };
}

export type CreateInvoiceInput = {
  organizationId: string; actor: { id: string; name: string };
  supplierId?: string; purchaseOrderId?: string | null;
  invoiceNumber: string; invoiceDate: Date; dueDate?: Date | null; currency?: string;
  subtotal: number; taxAmount: number; totalAmount: number; notes?: string | null; source?: "STAFF" | "SUPPLIER";
  lines: { poLineId?: string | null; description: string; quantity: number; unitPrice: number; lineTotal: number }[];
};

export async function createInvoice(i: CreateInvoiceInput): Promise<Result> {
  const po = i.purchaseOrderId ? await prisma.purchaseOrder.findFirst({ where: { id: i.purchaseOrderId, organizationId: i.organizationId }, include: { lineItems: { select: { id: true } } } }) : null;
  if (i.purchaseOrderId && !po) return { status: 422, json: { error: "Purchase order not found" } };
  const supplierId = i.supplierId ?? po?.supplierId ?? undefined;
  if (!supplierId) return { status: 422, json: { error: "Choose the supplier this invoice is from" } };
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, organizationId: i.organizationId }, select: { id: true } });
  if (!supplier) return { status: 422, json: { error: "Supplier not found" } };
  // A line may only point at a line of a PO in this organisation — never another tenant's.
  const wanted = i.lines.map(l => l.poLineId).filter((x): x is string => !!x);
  if (wanted.length) {
    const ok = await prisma.purchaseOrderLineItem.count({ where: { id: { in: wanted }, purchaseOrder: { organizationId: i.organizationId } } });
    if (ok !== new Set(wanted).size) return { status: 422, json: { error: "One of the lines refers to a purchase-order line that doesn't exist" } };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const invoice = await prisma.invoice.create({
        data: {
          organizationId: i.organizationId, internalNumber: await nextInvoiceNumber(i.organizationId), invoiceNumber: i.invoiceNumber.trim(),
          supplierId, purchaseOrderId: po?.id ?? null, invoiceDate: i.invoiceDate, dueDate: i.dueDate ?? null, currency: (i.currency ?? po?.currency ?? "INR").toUpperCase(),
          subtotal: i.subtotal, taxAmount: i.taxAmount, totalAmount: i.totalAmount, notes: i.notes ?? null, createdById: i.actor.id, source: i.source ?? "STAFF",
          lines: { create: i.lines.map(l => ({ poLineId: l.poLineId ?? null, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: l.lineTotal })) },
        },
      });
      await logAudit({ organizationId: i.organizationId, userId: i.actor.id, userName: i.actor.name, action: "CREATED", entity: "INVOICE", entityId: invoice.id, entityLabel: `${invoice.internalNumber} (${invoice.invoiceNumber})` });
      const m = await matchInvoice(invoice.id);
      return { status: 201, json: { invoice: m!.invoice, match: m!.result, autoApproved: m!.autoApproved } };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = String((e.meta as { target?: unknown })?.target ?? "");
        if (target.includes("invoiceNumber")) {
          const existing = await prisma.invoice.findFirst({ where: { organizationId: i.organizationId, supplierId, invoiceNumber: i.invoiceNumber.trim() }, select: { internalNumber: true, status: true } });
          return { status: 409, json: { error: `This supplier's invoice ${i.invoiceNumber.trim()} is already recorded${existing ? ` as ${existing.internalNumber} (${existing.status.toLowerCase()})` : ""}. The same invoice can't be entered twice.` } };
        }
        if (attempt < 2) continue; // internal number collided with a concurrent create
      }
      throw e;
    }
  }
  return { status: 500, json: { error: "Could not create the invoice" } };
}

// ─── Decisions ───────────────────────────────────────────────────────────────

/** Approving your own entry is only allowed when nobody else could (a sole Admin) — and is flagged. */
export async function invoiceApprovalVerdict(opts: { organizationId: string; creatorId: string; approver: { id: string; role: string } }): Promise<{ allowed: true; selfApproval: boolean } | { allowed: false; reason: string }> {
  if (opts.approver.role !== "ADMIN" && opts.approver.role !== "PROCUREMENT") return { allowed: false, reason: "Your role can't approve invoices" };
  if (opts.approver.id !== opts.creatorId) return { allowed: true, selfApproval: false };
  const others = await prisma.user.count({ where: { organizationId: opts.organizationId, id: { not: opts.creatorId }, role: { in: ["ADMIN", "PROCUREMENT"] }, AND: [{ authId: { not: null } }, { NOT: { authId: { startsWith: "pending_" } } }] } });
  if (others > 0) return { allowed: false, reason: "You entered this invoice, so someone else has to approve it" };
  if (opts.approver.role !== "ADMIN") return { allowed: false, reason: "You entered this invoice and nobody else can approve it — ask an Admin, or invite another approver" };
  return { allowed: true, selfApproval: true };
}

export async function decideInvoice(opts: {
  organizationId: string; actor: { id: string; name: string; role: string }; invoiceId: string;
  action: "approve" | "override" | "reject" | "mark_paid" | "rematch"; reason?: string; reference?: string;
}): Promise<Result> {
  const inv = await prisma.invoice.findFirst({ where: { id: opts.invoiceId, organizationId: opts.organizationId } });
  if (!inv) return { status: 404, json: { error: "Not found" } };
  const label = `${inv.internalNumber} (${inv.invoiceNumber})`;
  const audit = (action: "APPROVED" | "REJECTED" | "UPDATED", details: Record<string, unknown>) => logAudit({ organizationId: opts.organizationId, userId: opts.actor.id, userName: opts.actor.name, action, entity: "INVOICE", entityId: inv.id, entityLabel: label, details });
  const wrong = (needs: string) => ({ status: 422, json: { error: `Only ${needs} invoices can be ${opts.action === "mark_paid" ? "marked paid" : opts.action + "d"}. This one is ${inv.status.toLowerCase()}.` } });

  if (opts.action === "rematch") {
    if (!["RECEIVED", "MATCHED", "EXCEPTION"].includes(inv.status)) return wrong("unresolved");
    const m = await matchInvoice(inv.id);
    return { status: 200, json: { invoice: m!.invoice, match: m!.result, autoApproved: m!.autoApproved } };
  }

  if (opts.action === "approve" || opts.action === "override") {
    const overriding = opts.action === "override";
    if (overriding ? inv.status !== "EXCEPTION" : inv.status !== "MATCHED") return wrong(overriding ? "exception" : "matched");
    if (overriding) {
      if (opts.actor.role !== "ADMIN") return { status: 403, json: { error: "Only an Admin can approve an invoice that failed its match" } };
      if ((opts.reason ?? "").trim().length < 10) return { status: 422, json: { error: "Explain why you're approving despite the exceptions (at least a sentence) — it goes in the audit trail" } };
    }
    // A supplier-submitted invoice has no staff author, so nobody is barred from approving it as "their own".
    const v = await invoiceApprovalVerdict({ organizationId: opts.organizationId, creatorId: inv.source === "SUPPLIER" ? "" : inv.createdById, approver: opts.actor });
    if (v.allowed === false) return { status: 403, json: { error: v.reason } };
    const done = await prisma.invoice.updateMany({ where: { id: inv.id, status: inv.status }, data: { status: "APPROVED", approvedById: opts.actor.id, approvedAt: new Date(), approvalNote: opts.reason?.trim() ?? null, overridden: overriding } });
    if (done.count === 0) return { status: 409, json: { error: "This invoice was just changed by someone else — reload and try again" } };
    await audit("APPROVED", { overridden: overriding, reason: opts.reason, ...(v.selfApproval && { selfApproved: true, note: "No other approver was available" }), ...(overriding && { exceptions: ((inv.matchResult as { issues?: { code: string }[] } | null)?.issues ?? []).filter(x => x).map(x => x.code) }) });
    return { status: 200, json: { invoice: await prisma.invoice.findUnique({ where: { id: inv.id } }), selfApproval: v.selfApproval } };
  }

  if (opts.action === "reject") {
    if (!["RECEIVED", "MATCHED", "EXCEPTION"].includes(inv.status)) return wrong("unresolved");
    if ((opts.reason ?? "").trim().length < 3) return { status: 422, json: { error: "Say why you're rejecting it" } };
    const done = await prisma.invoice.updateMany({ where: { id: inv.id, status: inv.status }, data: { status: "REJECTED", rejectionReason: opts.reason!.trim() } });
    if (done.count === 0) return { status: 409, json: { error: "This invoice was just changed by someone else — reload and try again" } };
    await audit("REJECTED", { reason: opts.reason });
    return { status: 200, json: { invoice: await prisma.invoice.findUnique({ where: { id: inv.id } }) } };
  }

  // mark_paid
  if (inv.status !== "APPROVED") return wrong("approved");
  if (!(opts.reference ?? "").trim()) return { status: 422, json: { error: "Enter the payment reference (e.g. the bank transfer or UTR number)" } };
  const done = await prisma.invoice.updateMany({ where: { id: inv.id, status: "APPROVED" }, data: { status: "PAID", paidAt: new Date(), paymentReference: opts.reference!.trim().slice(0, 100) } });
  if (done.count === 0) return { status: 409, json: { error: "This invoice was just changed by someone else — reload and try again" } };
  await audit("UPDATED", { paid: true, reference: opts.reference });
  return { status: 200, json: { invoice: await prisma.invoice.findUnique({ where: { id: inv.id } }) } };
}
