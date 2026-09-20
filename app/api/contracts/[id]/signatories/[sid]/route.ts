import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { contractAccess } from "@/lib/contracts-access";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; sid: string }> }) {
  const a = await contractAccess();
  if ("error" in a) return a.error;
  const { id, sid } = await ctx.params;
  const contract = await prisma.contract.findFirst({ where: { id, organizationId: a.org.id }, select: { status: true } });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!["DRAFT", "NEGOTIATION", "PENDING_APPROVAL"].includes(contract.status)) return NextResponse.json({ error: "Signatories can't be changed at this stage" }, { status: 422 });
  const removed = await prisma.contractSignatory.deleteMany({ where: { id: sid, contractId: id } });
  if (removed.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
