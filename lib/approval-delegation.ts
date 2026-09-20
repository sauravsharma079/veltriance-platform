import { prisma } from "@/lib/prisma";

/** People who are out of office right now and named this user as their delegate. */
export async function activeDelegators(userId: string): Promise<string[]> {
  const rows = await prisma.user.findMany({ where: { delegateId: userId, outOfOfficeUntil: { gt: new Date() } }, select: { id: true } });
  return rows.map(r => r.id);
}
