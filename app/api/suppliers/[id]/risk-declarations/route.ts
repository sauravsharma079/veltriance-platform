import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { recomputeAndSaveSupplierRisk } from "@/lib/supplier-risk";

async function getCtx() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const org = await getCurrentOrganization();
  if (!org) return null;
  return { org };
}

// Self-declared risk questionnaire (insurance, business continuity plan, anti-bribery
// policy, pending legal disputes) — stored separately from the rest of the onboarding
// profile so submitting it never clobbers unrelated profile fields.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const c = await getCtx();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supplier = await prisma.supplier.findFirst({ where: { id, organizationId: c.org.id } });
  if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as { riskDeclarations?: Record<string, boolean> };
  if (!body.riskDeclarations || typeof body.riskDeclarations !== "object")
    return NextResponse.json({ error: "riskDeclarations object required" }, { status: 400 });

  await prisma.supplierOnboardingProfile.upsert({
    where: { supplierId: id },
    create: { supplierId: id, riskDeclarations: body.riskDeclarations as object },
    update: { riskDeclarations: body.riskDeclarations as object, updatedAt: new Date() },
  });

  const breakdown = await recomputeAndSaveSupplierRisk(id);
  return NextResponse.json({ breakdown });
}
