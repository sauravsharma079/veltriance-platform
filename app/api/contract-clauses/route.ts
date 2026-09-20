import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { contractAccess } from "@/lib/contracts-access";
import { clauseSchema } from "@/lib/contract-clause-schema";

export async function GET() {
  const a = await contractAccess();
  if ("error" in a) return a.error;
  const clauses = await prisma.contractClause.findMany({ where: { organizationId: a.org.id }, orderBy: [{ category: "asc" }, { title: "asc" }] });
  return NextResponse.json({ clauses });
}

export async function POST(req: NextRequest) {
  const a = await contractAccess();
  if ("error" in a) return a.error;
  const parsed = clauseSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 });
  const clause = await prisma.contractClause.create({ data: { ...parsed.data, organizationId: a.org.id } });
  await logAudit({ organizationId: a.org.id, userId: a.profile.id, userName: a.profile.name, action: "CREATED", entity: "CONTRACT_CLAUSE", entityId: clause.id, entityLabel: clause.title });
  return NextResponse.json({ clause }, { status: 201 });
}
