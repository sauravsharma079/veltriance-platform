import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { validateFile, uploadSupplierDocument } from "@/lib/supabase/storage";
import { scanDocument } from "@/lib/document-scan";
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

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supplier = await prisma.supplier.findFirst({ where: { id, organizationId: ctx.org.id } });
  if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 }); }

  const file = form.get("file");
  const docType = String(form.get("type") ?? "").trim();
  const expiryDateRaw = form.get("expiryDate");

  if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (!docType) return NextResponse.json({ error: "type is required" }, { status: 400 });

  const fileValidation = validateFile(file.type, file.size);
  if (!fileValidation.ok) return NextResponse.json({ error: fileValidation.error }, { status: 422 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const uploadResult = await uploadSupplierDocument({
    organizationId: ctx.org.id, supplierId: id, fileName: file.name, mimeType: file.type, bytes,
  });
  if (uploadResult.ok === false) return NextResponse.json({ error: uploadResult.error }, { status: 502 });

  const profile = await prisma.supplierOnboardingProfile.findUnique({ where: { supplierId: id } });
  const scan = scanDocument({ docType, mimeType: file.type, fileSize: uploadResult.size, profile });

  const doc = await prisma.supplierDocument.create({
    data: {
      supplierId: id, type: docType, name: form.get("name") ? String(form.get("name")) : file.name,
      fileUrl: uploadResult.url, fileSize: uploadResult.size, mimeType: file.type,
      status: "PENDING",
      expiryDate: expiryDateRaw ? new Date(String(expiryDateRaw)) : null,
      validationNotes: scan as unknown as object,
    },
  });

  const riskBreakdown = await recomputeAndSaveSupplierRisk(id);
  return NextResponse.json({ document: doc, scan, riskBreakdown }, { status: 201 });
}
