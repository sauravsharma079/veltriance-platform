import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invoiceAccess } from "@/lib/invoice-access";

/** Purchase orders an invoice can be raised against. */
export async function GET() {
  const a = await invoiceAccess();
  if ("error" in a) return a.error;
  const pos = await prisma.purchaseOrder.findMany({
    where: { organizationId: a.org.id, status: { in: ["SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED", "RECEIVED"] } },
    orderBy: { createdAt: "desc" }, take: 200,
    select: { id: true, poNumber: true, status: true, currency: true, totalAmount: true, supplier: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ purchaseOrders: pos });
}
