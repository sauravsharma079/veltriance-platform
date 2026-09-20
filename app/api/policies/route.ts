import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { orgAccess } from "@/lib/org-access";
import { RULE_TYPES, type RuleType } from "@/lib/policy";

export async function GET() {
  const a = await orgAccess({ roles: ["ADMIN", "PROCUREMENT"], module: "INTAKE_TO_PO" });
  if ("error" in a) return a.error;
  const rules = await prisma.policyRule.findMany({ where: { organizationId: a.org.id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ rules, types: Object.entries(RULE_TYPES).map(([type, t]) => ({ type, label: t.label, describe: t.describe })), canEdit: a.profile.role === "ADMIN" });
}

const schema = z.object({ type: z.string(), name: z.string().trim().min(2).max(120), params: z.unknown() });

export async function POST(req: NextRequest) {
  const a = await orgAccess({ roles: ["ADMIN"], module: "INTAKE_TO_PO" });
  if ("error" in a) return a.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 422 });
  const def = RULE_TYPES[parsed.data.type as RuleType];
  if (!def) return NextResponse.json({ error: "Unknown rule type" }, { status: 422 });
  const p = def.params.safeParse(parsed.data.params);
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Invalid rule settings" }, { status: 422 });
  const rule = await prisma.policyRule.create({ data: { organizationId: a.org.id, type: parsed.data.type, name: parsed.data.name, params: p.data as object } });
  await logAudit({ organizationId: a.org.id, userId: a.profile.id, userName: a.profile.name, action: "CREATED", entity: "APPROVAL_RULE", entityId: rule.id, entityLabel: `Policy: ${rule.name}`, details: { type: rule.type, params: p.data } });
  return NextResponse.json({ rule }, { status: 201 });
}
