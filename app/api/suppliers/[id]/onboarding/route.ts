import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { moduleGuard } from "@/lib/licensing";
import { getCurrentOrganization } from "@/lib/tenant";
import { recomputeAndSaveSupplierRisk } from "@/lib/supplier-risk";
import { saveOnboardingProfile } from "@/lib/onboarding";

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
  { const blocked = moduleGuard(ctx.org, "SUPPLIER_RISK"); if (blocked) return blocked; }
  const supplier = await prisma.supplier.findFirst({ where: { id, organizationId: ctx.org.id }, select: { id: true } });
  if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const profile = await prisma.supplierOnboardingProfile.findUnique({ where: { supplierId: id } });
  return NextResponse.json({ profile });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  { const blocked = moduleGuard(ctx.org, "SUPPLIER_RISK"); if (blocked) return blocked; }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const existingSupplier = await prisma.supplier.findFirst({ where: { id, organizationId: ctx.org.id } });
  if (!existingSupplier) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Same validation, scoring and stage rules as the vendor's own portal, and only whitelisted fields are written.
  const saved = await saveOnboardingProfile(id, body as Record<string, unknown>);
  if (saved.ok === false) return NextResponse.json({ error: saved.error, validation: saved.validation }, { status: saved.status });
  const riskBreakdown = await recomputeAndSaveSupplierRisk(id);
  return NextResponse.json({ profile: saved.profile, completionScore: saved.completionScore, riskBreakdown, requirements: saved.requirements });
}
