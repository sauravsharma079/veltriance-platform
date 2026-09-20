import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { orgAccess } from "@/lib/org-access";

const patch = z.object({ active: z.boolean().optional(), name: z.string().trim().min(2).max(120).optional() });

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await orgAccess({ roles: ["ADMIN"], module: "INTAKE_TO_PO" });
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 422 });
  const done = await prisma.policyRule.updateMany({ where: { id, organizationId: a.org.id }, data: parsed.data });
  if (done.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logAudit({ organizationId: a.org.id, userId: a.profile.id, userName: a.profile.name, action: "UPDATED", entity: "APPROVAL_RULE", entityId: id, entityLabel: "Policy", details: parsed.data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await orgAccess({ roles: ["ADMIN"], module: "INTAKE_TO_PO" });
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const done = await prisma.policyRule.deleteMany({ where: { id, organizationId: a.org.id } });
  if (done.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logAudit({ organizationId: a.org.id, userId: a.profile.id, userName: a.profile.name, action: "DELETED", entity: "APPROVAL_RULE", entityId: id, entityLabel: "Policy" });
  return NextResponse.json({ success: true });
}
