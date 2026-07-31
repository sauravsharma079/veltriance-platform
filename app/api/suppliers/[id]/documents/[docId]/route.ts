import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { recomputeAndSaveSupplierRisk } from "@/lib/supplier-risk";

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

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await context.params;
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const doc = await prisma.supplierDocument.update({
    where: { id: docId },
    data: {
      status: body.status, rejectedNote: body.rejectedNote || null,
      verifiedAt: body.status === "VERIFIED" ? new Date() : null,
      ...(body.expiryDate !== undefined && { expiryDate: body.expiryDate ? new Date(body.expiryDate) : null }),
    },
  });
  const riskBreakdown = await recomputeAndSaveSupplierRisk(id);
  return NextResponse.json({ document: doc, riskBreakdown });
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await context.params;
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.supplierDocument.delete({ where: { id: docId } });
  const riskBreakdown = await recomputeAndSaveSupplierRisk(id);
  return NextResponse.json({ success: true, riskBreakdown });
}
