import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { contractAccess } from "@/lib/contracts-access";
import { eligibleApprovers } from "@/lib/contract-approval";

/** Who could approve this contract — used to choose an approver when submitting. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await contractAccess();
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const contract = await prisma.contract.findFirst({ where: { id, organizationId: a.org.id }, select: { ownerId: true } });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const approvers = await eligibleApprovers(a.org.id, contract.ownerId);
  return NextResponse.json({ approvers: approvers.map(u => ({ id: u.id, name: u.name, role: u.role })) });
}
