import { prisma } from "@/lib/prisma";

export async function generateRequisitionNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.requisition.count({
    where: { organizationId, requisitionNumber: { startsWith: `REQ-${year}-` } },
  });
  const next = String(count + 1).padStart(5, "0");
  return `REQ-${year}-${next}`;
}
