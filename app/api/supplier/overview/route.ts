import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-session";

export async function GET() {
  const a = await requireSupplier();
  if ("error" in a) return a.error;
  const { supplier, organization, email } = a.s;
  const [pos, invoices] = await Promise.all([
    prisma.purchaseOrder.findMany({ where: { supplierId: supplier.id, organizationId: supplier.organizationId, status: { not: "DRAFT" } }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, poNumber: true, status: true, currency: true, totalAmount: true, expectedDelivery: true, acknowledgedAt: true, createdAt: true } }),
    prisma.invoice.findMany({ where: { supplierId: supplier.id, organizationId: supplier.organizationId }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, invoiceNumber: true, status: true, currency: true, totalAmount: true, invoiceDate: true, dueDate: true, paidAt: true, paymentReference: true, rejectionReason: true, purchaseOrder: { select: { poNumber: true } } } }),
  ]);
  return NextResponse.json({ supplier: supplier.name, buyer: organization.name, email, purchaseOrders: pos, invoices });
}
