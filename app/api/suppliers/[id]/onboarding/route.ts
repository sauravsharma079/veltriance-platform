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
  const FIELDS = ["legalName","businessType","panNumber","gstNumber","bankName","accountNumber","ifscCode","beneficiaryName","regAddressLine1","regCity","regState","regPostal"];
  const filled = FIELDS.filter(f => body[f] && String(body[f]).trim()).length;
  const completionScore = Math.round((filled / FIELDS.length) * 100);
  const profile = await prisma.supplierOnboardingProfile.upsert({
    where: { supplierId: id },
    create: { supplierId: id, ...body, completionScore },
    update: { ...body, completionScore, updatedAt: new Date() },
  });
  const STAGES = ["REGISTRATION","VALIDATION","RISK_ASSESSMENT","COMPLIANCE_REVIEW","PROCUREMENT_APPROVAL","ACTIVE"];
  const idx = completionScore >= 80 ? 3 : completionScore >= 50 ? 2 : completionScore >= 20 ? 1 : 0;
  await prisma.supplier.update({ where: { id }, data: { onboardingStage: STAGES[idx] as never } });
  return NextResponse.json({ profile, completionScore });
}
