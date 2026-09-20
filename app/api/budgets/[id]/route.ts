import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { orgAccess } from "@/lib/org-access";
import { budgetFields } from "@/lib/budget-schema";

const patch = z.object(budgetFields).partial();

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await orgAccess({ roles: ["ADMIN"], module: "INTAKE_TO_PO" });
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 });
  const d = parsed.data;
  const done = await prisma.budget.updateMany({ where: { id, organizationId: a.org.id }, data: { ...d, ...(d.startDate && { startDate: new Date(d.startDate) }), ...(d.endDate && { endDate: new Date(`${d.endDate}T23:59:59`) }) } });
  if (done.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logAudit({ organizationId: a.org.id, userId: a.profile.id, userName: a.profile.name, action: "UPDATED", entity: "COA", entityId: id, entityLabel: "Budget", details: { fields: Object.keys(d) } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await orgAccess({ roles: ["ADMIN"], module: "INTAKE_TO_PO" });
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const done = await prisma.budget.deleteMany({ where: { id, organizationId: a.org.id } });
  if (done.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logAudit({ organizationId: a.org.id, userId: a.profile.id, userName: a.profile.name, action: "DELETED", entity: "COA", entityId: id, entityLabel: "Budget" });
  return NextResponse.json({ success: true });
}
