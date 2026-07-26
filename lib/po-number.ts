import { prisma } from "@/lib/prisma";

export async function generatePONumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.purchaseOrder.count({
    where: { organizationId, poNumber: { startsWith: `PO-${year}-` } },
  });
  const next = String(count + 1).padStart(5, "0");
  return `PO-${year}-${next}`;
}
