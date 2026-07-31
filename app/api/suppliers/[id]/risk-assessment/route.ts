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

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const c = await getCtx();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supplier = await prisma.supplier.findFirst({ where: { id, organizationId: c.org.id } });
  if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ breakdown: supplier.riskBreakdown ?? null });
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const c = await getCtx();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supplier = await prisma.supplier.findFirst({ where: { id, organizationId: c.org.id } });
  if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const breakdown = await recomputeAndSaveSupplierRisk(id);
  return NextResponse.json({ breakdown });
}
