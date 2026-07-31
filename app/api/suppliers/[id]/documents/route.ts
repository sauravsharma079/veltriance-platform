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

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const documents = await prisma.supplierDocument.findMany({ where: { supplierId: id }, orderBy: { createdAt: "desc" } });
  // Lazily flip PENDING/VERIFIED docs whose expiryDate has passed — no separate cron needed.
  const now = new Date();
  const toExpire = documents.filter(d => d.expiryDate && d.expiryDate < now && d.status !== "EXPIRED");
  if (toExpire.length > 0) {
    await prisma.supplierDocument.updateMany({ where: { id: { in: toExpire.map(d => d.id) } }, data: { status: "EXPIRED" } });
    for (const d of toExpire) d.status = "EXPIRED";
  }
  return NextResponse.json({ documents });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const doc = await prisma.supplierDocument.create({
    data: {
      supplierId: id, type: body.type, name: body.name, fileUrl: body.fileUrl || "#",
      mimeType: "application/pdf", status: "PENDING",
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
    },
  });
  const riskBreakdown = await recomputeAndSaveSupplierRisk(id);
  return NextResponse.json({ document: doc, riskBreakdown }, { status: 201 });
}
