import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { publicBaseUrl } from "@/lib/contracts";
import { supplierByPortalToken } from "@/lib/vendor-portal";
import { checklistFor, saveOnboardingProfile, DECLARATIONS, OPTIONAL_DOC_TYPES } from "@/lib/onboarding";
import { requirementsFor, SUPPORTED_COUNTRIES, DOC_TYPE_LABELS } from "@/lib/onboarding-requirements";
import { recomputeAndSaveSupplierRisk } from "@/lib/supplier-risk";

/**
 * Unauthenticated endpoint behind a vendor's personal onboarding link. The token is 256 bits of
 * randomness (only its hash is stored). It exposes ONE supplier — their own record — and never
 * the buyer's internal notes, risk scores or anyone else's data. Editing is only possible while
 * the supplier is still awaiting approval.
 */
const PROFILE_KEYS = ["legalName", "businessType", "panNumber", "gstNumber", "msmeNumber", "taxIdType", "taxIdValue", "beneficiaryName", "bankName", "accountNumber", "ifscCode", "routingNumber", "bsb", "iban", "swiftCode", "accountType", "regAddressLine1", "regCity", "regState", "regPostal", "womenOwned", "minorityOwned", "smallBusiness"] as const;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const sup = await supplierByPortalToken((await ctx.params).token);
  if (!sup) return NextResponse.json({ error: "This link isn't valid any more" }, { status: 404 });
  const data = await checklistFor(sup.id);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { supplier, profile, documents, questions, checklist } = data;
  const reqs = requirementsFor(supplier.country);
  const answers = (supplier.customFieldAnswers ?? {}) as Record<string, unknown>;
  const decl = (profile?.riskDeclarations ?? {}) as Record<string, unknown>;
  const p = (profile ?? {}) as Record<string, unknown>;

  return NextResponse.json({
    organization: sup.organization.name,
    supplier: { name: supplier.name, country: supplier.country ?? "Other", status: supplier.status, canEdit: supplier.status === "PENDING_APPROVAL", submittedAt: supplier.portalSubmittedAt },
    countries: SUPPORTED_COUNTRIES,
    requirements: {
      taxFields: reqs.taxFields, bankFields: reqs.bankFields,
      docs: [...reqs.requiredDocs.map(t => ({ type: t, label: DOC_TYPE_LABELS[t] ?? t, required: true })), ...OPTIONAL_DOC_TYPES.filter(t => !reqs.requiredDocs.includes(t)).map(t => ({ type: t, label: DOC_TYPE_LABELS[t] ?? t, required: false }))],
    },
    profile: Object.fromEntries(PROFILE_KEYS.map(k => [k, p[k] ?? (k === "womenOwned" || k === "minorityOwned" || k === "smallBusiness" ? false : "")])),
    documents: documents.map(d => ({ id: d.id, type: d.type, label: DOC_TYPE_LABELS[d.type] ?? d.type, name: d.name, status: d.status, rejectedNote: d.rejectedNote, uploadedAt: d.createdAt, expiryDate: d.expiryDate })),
    declarations: { defs: DECLARATIONS, values: Object.fromEntries(DECLARATIONS.map(d => [d.key, typeof decl[d.key] === "boolean" ? decl[d.key] : null])) },
    questions: questions.map(q => ({ fieldKey: q.fieldKey, name: q.name, fieldType: q.fieldType, required: q.required, options: q.options, helpText: q.helpText, value: answers[q.fieldKey] ?? "" })),
    checklist,
  });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save_details"), country: z.string().optional(), fields: z.record(z.string(), z.union([z.string(), z.boolean()])) }),
  z.object({ action: z.literal("save_declarations"), values: z.record(z.string(), z.boolean()) }),
  z.object({ action: z.literal("save_answers"), answers: z.record(z.string(), z.string().max(2000)) }),
  z.object({ action: z.literal("submit") }),
]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const sup = await supplierByPortalToken((await ctx.params).token);
  if (!sup) return NextResponse.json({ error: "This link isn't valid any more" }, { status: 404 });
  if (sup.status !== "PENDING_APPROVAL") return NextResponse.json({ error: sup.status === "ACTIVE" ? "You're already approved — there's nothing more to complete." : "This onboarding is closed." }, { status: 422 });
  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 });
  const d = parsed.data;
  const audit = (details: Record<string, unknown>) => logAudit({ organizationId: sup.organizationId, userName: `${sup.name} (vendor)`, action: "UPDATED", entity: "SUPPLIER", entityId: sup.id, entityLabel: sup.name, details });

  if (d.action === "save_details") {
    const fields: Record<string, unknown> = {};
    for (const k of PROFILE_KEYS) if (k in d.fields) fields[k] = d.fields[k];
    const saved = await saveOnboardingProfile(sup.id, { ...fields, ...(d.country && { country: d.country }) });
    if (saved.ok === false) return NextResponse.json({ error: saved.error, validation: saved.validation }, { status: saved.status });
    await audit({ portal: "details saved", completion: saved.completionScore });
    return NextResponse.json({ ok: true });
  }

  if (d.action === "save_declarations") {
    const values = Object.fromEntries(DECLARATIONS.map(x => [x.key, d.values[x.key]]).filter(([, v]) => typeof v === "boolean"));
    const existing = await prisma.supplierOnboardingProfile.findUnique({ where: { supplierId: sup.id }, select: { riskDeclarations: true } });
    const merged = { ...((existing?.riskDeclarations ?? {}) as object), ...values };
    await prisma.supplierOnboardingProfile.upsert({ where: { supplierId: sup.id }, create: { supplierId: sup.id, riskDeclarations: merged }, update: { riskDeclarations: merged, updatedAt: new Date() } });
    await recomputeAndSaveSupplierRisk(sup.id);
    await audit({ portal: "risk declarations saved" });
    return NextResponse.json({ ok: true });
  }

  if (d.action === "save_answers") {
    const data = await checklistFor(sup.id);
    const allowed = new Set((data?.questions ?? []).map(q => q.fieldKey));
    const clean = Object.fromEntries(Object.entries(d.answers).filter(([k]) => allowed.has(k)));
    const merged = { ...((sup.customFieldAnswers ?? {}) as object), ...clean };
    await prisma.supplier.update({ where: { id: sup.id }, data: { customFieldAnswers: merged as Prisma.InputJsonValue } });
    await audit({ portal: "questionnaire saved" });
    return NextResponse.json({ ok: true });
  }

  // submit: "I'm done — please review". Only allowed when nothing is missing or invalid.
  const data = await checklistFor(sup.id);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!data.checklist.readyForReview) return NextResponse.json({ error: `Not quite finished — ${data.checklist.missing.length} item(s) still need attention.`, missing: data.checklist.missing.map(m => m.label) }, { status: 422 });
  await prisma.supplier.update({ where: { id: sup.id }, data: { portalSubmittedAt: new Date(), onboardingStage: "COMPLIANCE_REVIEW" } });
  await recomputeAndSaveSupplierRisk(sup.id);
  await audit({ portal: "submitted for review" });

  // Tell the people who can approve. Best effort — the in-app notification is the backstop.
  const team = await prisma.user.findMany({ where: { organizationId: sup.organizationId, role: { in: ["ADMIN", "PROCUREMENT"] }, AND: [{ authId: { not: null } }, { NOT: { authId: { startsWith: "pending_" } } }] }, select: { name: true, email: true } });
  const link = `${publicBaseUrl(new URL(req.url).origin)}/dashboard/suppliers/${sup.id}`;
  await Promise.all(team.map(u => sendEmail({ to: u.email, subject: `Supplier ready for review: ${sup.name}`, text: `Hello ${u.name},\n\n${sup.name} has completed their supplier onboarding and is ready for your review.\n\nReview and approve here:\n${link}\n\n${sup.organization.name}` })));
  return NextResponse.json({ ok: true, notified: team.length });
}
