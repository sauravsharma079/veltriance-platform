import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyLink } from "@/lib/signed-links";
import { postReceipt, mayReceive, RECEIVABLE } from "@/lib/receiving";

/**
 * One-click delivery confirmation from an email. The link is signed, names one person and one PO, and
 * expires; it only works while there is still something outstanding and that person may receive it.
 */
async function load(token: string) {
  const link = verifyLink<{ p: string; u: string }>(token, "receive");
  if (!link) return null;
  const user = await prisma.user.findUnique({ where: { id: link.u }, select: { id: true, name: true, role: true, organizationId: true } });
  const po = user ? await prisma.purchaseOrder.findFirst({ where: { id: link.p, organizationId: user.organizationId }, include: { lineItems: { orderBy: { createdAt: "asc" } }, supplier: { select: { name: true } }, organization: { select: { name: true } } } }) : null;
  if (!user || !po) return null;
  const outstanding = po.lineItems.map(l => ({ id: l.id, description: l.description, unit: l.unit, remaining: Math.round((Number(l.quantity) - Number(l.receivedQty)) * 100) / 100 })).filter(l => l.remaining > 0);
  const allowed = await mayReceive(user, po);
  const reason = !RECEIVABLE.includes(po.status) || outstanding.length === 0 ? "Everything on this order has already been received." : !allowed ? "You're not able to record receipts for this order." : null;
  return { user, po, outstanding, canConfirm: reason === null, reason };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const d = await load((await ctx.params).token);
  if (!d) return NextResponse.json({ error: "This link isn't valid any more" }, { status: 404 });
  return NextResponse.json({ organization: d.po.organization.name, poNumber: d.po.poNumber, supplier: d.po.supplier?.name ?? null, expectedDelivery: d.po.expectedDelivery, poId: d.po.id, canConfirm: d.canConfirm, closedReason: d.reason, lines: d.outstanding });
}

const schema = z.object({ action: z.literal("all_received") });

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const d = await load((await ctx.params).token);
  if (!d) return NextResponse.json({ error: "This link isn't valid any more" }, { status: 404 });
  if (!d.canConfirm) return NextResponse.json({ error: d.reason }, { status: 409 });
  if (!schema.safeParse(await req.json().catch(() => null)).success) return NextResponse.json({ error: "Invalid request" }, { status: 422 });
  // Confirming here means "everything still outstanding arrived". Partial or damaged deliveries are recorded in the app.
  const r = await postReceipt({ organizationId: d.po.organizationId, actor: { id: d.user.id, name: d.user.name }, purchaseOrderId: d.po.id, lines: d.outstanding.map(l => ({ poLineId: l.id, accepted: l.remaining })), deliveryNote: "Confirmed by email link" });
  return NextResponse.json(r.json, { status: r.status });
}
