import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-session";
import { invoiceableSummary } from "@/lib/invoicing";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireSupplier();
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const po = await prisma.purchaseOrder.findFirst({ where: { id, supplierId: a.s.supplier.id, organizationId: a.s.supplier.organizationId, status: { not: "DRAFT" } }, select: { id: true, poNumber: true, status: true, currency: true, totalAmount: true, paymentTerms: true, notes: true, expectedDelivery: true, acknowledgedAt: true, createdAt: true } });
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const s = await invoiceableSummary(po.id);
  return NextResponse.json({ buyer: a.s.organization.name, po, lines: s?.lines ?? [] });
}
