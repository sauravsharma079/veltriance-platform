import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { validateTaxOrBankField } from "@/lib/validators";
import { recomputeAndSaveSupplierRisk } from "@/lib/supplier-risk";
import { requirementsFor } from "@/lib/onboarding-requirements";

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

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await prisma.supplierOnboardingProfile.findUnique({ where: { supplierId: id } });
  return NextResponse.json({ profile });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const existingSupplier = await prisma.supplier.findFirst({ where: { id, organizationId: ctx.org.id } });
  if (!existingSupplier) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const country = body.country || existingSupplier.country || "Other";
  const req_ = requirementsFor(country);
  const FIELDS = [
    "legalName", "businessType",
    ...req_.taxFields.map(f => f.key),
    ...req_.bankFields.map(f => f.key),
    "beneficiaryName", "regAddressLine1", "regCity", "regState", "regPostal",
  ];
  const filled = FIELDS.filter(f => body[f] && String(body[f]).trim()).length;
  const completionScore = Math.round((filled / FIELDS.length) * 100);

  const validation: Record<string, { valid: boolean; message?: string }> = {};
  for (const f of [...req_.taxFields, ...req_.bankFields]) {
    if (f.validator && body[f.key]) validation[f.key] = validateTaxOrBankField(f.validator, body[f.key]);
  }
  const invalidFields = Object.entries(validation).filter(([, r]) => !r.valid);
  if (invalidFields.length > 0) {
    return NextResponse.json({
      error: invalidFields.map(([field, r]) => `${field}: ${r.message}`).join(", "),
      validation,
    }, { status: 422 });
  }

  const profile = await prisma.supplierOnboardingProfile.upsert({
    where: { supplierId: id },
    create: { supplierId: id, ...body, country, completionScore, validation },
    update: { ...body, country, completionScore, validation, updatedAt: new Date() },
  });
  const STAGES = ["REGISTRATION","VALIDATION","RISK_ASSESSMENT","COMPLIANCE_REVIEW","PROCUREMENT_APPROVAL","ACTIVE"];
  const idx = completionScore >= 80 ? 3 : completionScore >= 50 ? 2 : completionScore >= 20 ? 1 : 0;
  await prisma.supplier.update({ where: { id }, data: { country, onboardingStage: STAGES[idx] as never } });
  const riskBreakdown = await recomputeAndSaveSupplierRisk(id);
  return NextResponse.json({ profile, completionScore, riskBreakdown, requirements: req_ });
}
