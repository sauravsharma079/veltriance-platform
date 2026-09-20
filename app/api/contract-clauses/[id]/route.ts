import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { contractAccess } from "@/lib/contracts-access";
import { clauseSchema } from "@/lib/contract-clause-schema";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const a = await contractAccess();
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const parsed = clauseSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 });
  const updated = await prisma.contractClause.updateMany({ where: { id, organizationId: a.org.id }, data: parsed.data });
  if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logAudit({ organizationId: a.org.id, userId: a.profile.id, userName: a.profile.name, action: "UPDATED", entity: "CONTRACT_CLAUSE", entityId: id, details: { fields: Object.keys(parsed.data) } });
  return NextResponse.json({ clause: await prisma.contractClause.findUnique({ where: { id } }) });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const a = await contractAccess();
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const removed = await prisma.contractClause.deleteMany({ where: { id, organizationId: a.org.id } });
  if (removed.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logAudit({ organizationId: a.org.id, userId: a.profile.id, userName: a.profile.name, action: "DELETED", entity: "CONTRACT_CLAUSE", entityId: id });
  return NextResponse.json({ success: true });
}
