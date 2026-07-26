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
  const supplier = await prisma.supplier.findFirst({
    where: { id, organizationId: ctx.org.id },
    include: {
      contacts: true,
      documents: { orderBy: { createdAt: "desc" } },
      onboardingProfile: true,
      certifications_v2: true,
      performanceReviews: { orderBy: { createdAt: "desc" }, take: 4 },
      messages: { orderBy: { createdAt: "desc" }, take: 20 },
      purchaseOrders: { orderBy: { createdAt: "desc" }, take: 5,
        select: { id: true, poNumber: true, status: true, totalAmount: true, issuedAt: true } },
    },
  });
  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  return NextResponse.json({ supplier });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const existing = await prisma.supplier.findFirst({ where: { id, organizationId: ctx.org.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const allowed = ["name","contactEmail","contactName","contactPhone","category","website","city","state","country","tier","status","onboardingStage","riskLevel","riskScore","rating","preferred","notes"];
  const data: Record<string, unknown> = {};
  for (const f of allowed) if (body[f] !== undefined) data[f] = body[f];
  const supplier = await prisma.supplier.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
  return NextResponse.json({ supplier });
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const existing = await prisma.supplier.findFirst({ where: { id, organizationId: ctx.org.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.supplier.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
