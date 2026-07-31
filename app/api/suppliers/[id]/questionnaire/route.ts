import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

async function getCtx() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const [profile, org] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !org || profile.organizationId !== org.id) return null;
  return { profile, org };
}

// Dynamic Questionnaire Engine: a CustomField(entity=SUPPLIER) applies to a given
// supplier when its `categories` (if any) include the supplier's category AND every
// key in its `conditions` JSON matches the supplier's corresponding attribute.
// conditions example: {"country":["India","USA"],"riskLevel":["HIGH","CRITICAL"]}
function matchesConditions(conditions: unknown, ctx: Record<string, string | null | undefined>): boolean {
  if (!conditions || typeof conditions !== "object") return true;
  for (const [key, allowed] of Object.entries(conditions as Record<string, unknown>)) {
    if (!Array.isArray(allowed) || allowed.length === 0) continue;
    const val = ctx[key];
    if (!val || !allowed.includes(val)) return false;
  }
  return true;
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supplier = await prisma.supplier.findFirst({ where: { id, organizationId: ctx.org.id } });
  if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allFields = await prisma.customField.findMany({
    where: { organizationId: ctx.org.id, entity: "SUPPLIER", active: true },
    orderBy: { sortOrder: "asc" },
  });

  const matchCtx = { country: supplier.country, riskLevel: supplier.riskLevel, tier: supplier.tier, businessType: null as string | null };
  const applicable = allFields.filter(f =>
    (f.categories.length === 0 || (supplier.category != null && f.categories.includes(supplier.category))) &&
    matchesConditions(f.conditions, matchCtx)
  );

  const answers = (supplier.customFieldAnswers as Record<string, unknown> | null) ?? {};
  return NextResponse.json({
    fields: applicable.map(f => ({
      id: f.id, name: f.name, fieldKey: f.fieldKey, fieldType: f.fieldType,
      required: f.required, options: f.options, helpText: f.helpText,
      value: answers[f.fieldKey] ?? null,
    })),
  });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supplier = await prisma.supplier.findFirst({ where: { id, organizationId: ctx.org.id } });
  if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as { answers?: Record<string, string> };
  if (!body.answers || typeof body.answers !== "object")
    return NextResponse.json({ error: "answers object required" }, { status: 400 });

  const allFields = await prisma.customField.findMany({
    where: { organizationId: ctx.org.id, entity: "SUPPLIER", active: true },
  });
  const matchCtx = { country: supplier.country, riskLevel: supplier.riskLevel, tier: supplier.tier, businessType: null as string | null };
  const applicable = allFields.filter(f =>
    (f.categories.length === 0 || (supplier.category != null && f.categories.includes(supplier.category))) &&
    matchesConditions(f.conditions, matchCtx)
  );

  const existing = (supplier.customFieldAnswers as Record<string, unknown> | null) ?? {};
  const merged = { ...existing, ...body.answers };

  const missing = applicable.filter(f => f.required && !String(merged[f.fieldKey] ?? "").trim());
  if (missing.length > 0)
    return NextResponse.json({ error: `Missing required field(s): ${missing.map(f => f.name).join(", ")}` }, { status: 422 });

  const updated = await prisma.supplier.update({ where: { id }, data: { customFieldAnswers: merged as object } });
  return NextResponse.json({ customFieldAnswers: updated.customFieldAnswers });
}
