import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { supplierByPortalToken } from "@/lib/vendor-portal";
import { requirementsFor } from "@/lib/onboarding-requirements";
import { OPTIONAL_DOC_TYPES } from "@/lib/onboarding";
import { validateFile, uploadSupplierDocument } from "@/lib/supabase/storage";
import { scanDocument } from "@/lib/document-scan";
import { recomputeAndSaveSupplierRisk } from "@/lib/supplier-risk";

const MAX_DOCS = 30;

/** A vendor uploads a document against their own record. Same checks as the buyer-side upload. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const sup = await supplierByPortalToken((await ctx.params).token);
  if (!sup) return NextResponse.json({ error: "This link isn't valid any more" }, { status: 404 });
  if (sup.status !== "PENDING_APPROVAL") return NextResponse.json({ error: "Onboarding is closed, so documents can no longer be added." }, { status: 422 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Expected a file upload" }, { status: 400 }); }
  const file = form.get("file");
  const type = String(form.get("type") ?? "").trim();
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to upload" }, { status: 400 });
  // Only document types that belong to this vendor's onboarding — no free-form types.
  const allowed = new Set([...requirementsFor(sup.country).requiredDocs, ...OPTIONAL_DOC_TYPES]);
  if (!allowed.has(type)) return NextResponse.json({ error: "That isn't a document type we're asking for" }, { status: 422 });
  if ((await prisma.supplierDocument.count({ where: { supplierId: sup.id } })) >= MAX_DOCS) return NextResponse.json({ error: "Too many documents on file already — please contact the buyer." }, { status: 422 });
  const v = validateFile(file.type, file.size);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 422 });
  const expiryRaw = String(form.get("expiryDate") ?? "").trim();
  const expiry = expiryRaw ? new Date(expiryRaw) : null;
  if (expiry && isNaN(expiry.getTime())) return NextResponse.json({ error: "That expiry date isn't valid" }, { status: 422 });

  const up = await uploadSupplierDocument({ organizationId: sup.organizationId, supplierId: sup.id, fileName: file.name, mimeType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
  if (up.ok === false) return NextResponse.json({ error: "The upload failed — please try again." }, { status: 502 });
  const profile = await prisma.supplierOnboardingProfile.findUnique({ where: { supplierId: sup.id } });
  const scan = scanDocument({ docType: type, mimeType: file.type, fileSize: up.size, profile });
  const doc = await prisma.supplierDocument.create({
    data: { supplierId: sup.id, type, name: file.name.slice(0, 150), fileUrl: up.url, fileSize: up.size, mimeType: file.type, status: "PENDING", expiryDate: expiry, validationNotes: scan as unknown as object },
  });
  await recomputeAndSaveSupplierRisk(sup.id);
  await logAudit({ organizationId: sup.organizationId, userName: `${sup.name} (vendor)`, action: "UPLOADED", entity: "SUPPLIER", entityId: sup.id, entityLabel: sup.name, details: { type, portal: true } });
  return NextResponse.json({ document: { id: doc.id, type: doc.type, status: doc.status }, scan }, { status: 201 });
}
