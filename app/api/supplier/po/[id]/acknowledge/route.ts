import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { requireSupplier } from "@/lib/supplier-session";

const schema = z.object({ expectedDelivery: z.string().date().nullable().optional() });

/** The vendor confirms they've received the order (and may give the date they'll deliver by), or updates that date later. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireSupplier();
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "That date isn't valid" }, { status: 422 });
  const date = parsed.data.expectedDelivery ? new Date(`${parsed.data.expectedDelivery}T12:00:00Z`) : null;
  if (date && date.getTime() < Date.now() - 86_400_000) return NextResponse.json({ error: "The delivery date can't be in the past" }, { status: 422 });

  const where = { id, supplierId: a.s.supplier.id, organizationId: a.s.supplier.organizationId };
  const po = await prisma.purchaseOrder.findFirst({ where, select: { id: true, poNumber: true, status: true, createdBy: { select: { name: true, email: true } } } });
  if (!po || !["SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED"].includes(po.status)) return NextResponse.json({ error: "This order can't be acknowledged" }, { status: 409 });

  const first = po.status === "SENT";
  const done = await prisma.purchaseOrder.updateMany({ where: { ...where, status: po.status }, data: { ...(first && { status: "ACKNOWLEDGED", acknowledgedAt: new Date() }), ...(date && { expectedDelivery: date }) } });
  if (done.count === 0) return NextResponse.json({ error: "This order was just changed — reload and try again" }, { status: 409 });
  const who = `${a.s.supplier.name} (supplier portal)`;
  await logAudit({ organizationId: a.s.supplier.organizationId, userName: who, action: "UPDATED", entity: "PURCHASE_ORDER", entityId: po.id, entityLabel: po.poNumber, details: { acknowledged: first, expectedDelivery: parsed.data.expectedDelivery ?? null } });
  if (first) await sendEmail({ to: po.createdBy.email, subject: `${a.s.supplier.name} confirmed ${po.poNumber}`, text: `Hello ${po.createdBy.name},\n\n${a.s.supplier.name} acknowledged purchase order ${po.poNumber} in the supplier portal${parsed.data.expectedDelivery ? ` and expects to deliver by ${parsed.data.expectedDelivery}` : ""}.\n\n${a.s.organization.name}` }).catch(() => {});
  return NextResponse.json({ ok: true, acknowledged: first });
}
