import type { Prisma, Supplier, SupplierDocument, SupplierOnboardingProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirementsFor, SUPPORTED_COUNTRIES, DOC_TYPE_LABELS } from "@/lib/onboarding-requirements";
import { validateTaxOrBankField } from "@/lib/validators";
import { recomputeAndSaveSupplierRisk } from "@/lib/supplier-risk";

// Shared by the buyer-side onboarding screens and the vendor's self-service portal, so both
// apply exactly the same validation, scoring and stage rules.

const STAGES = ["REGISTRATION", "VALIDATION", "RISK_ASSESSMENT", "COMPLIANCE_REVIEW", "PROCUREMENT_APPROVAL", "ACTIVE"] as const;

const STRING_FIELDS = [
  "legalName", "businessType", "panNumber", "gstNumber", "msmeNumber", "taxIdType", "taxIdValue", "beneficiaryName", "bankName",
  "accountNumber", "ifscCode", "routingNumber", "bsb", "iban", "swiftCode", "accountType", "regAddressLine1", "regCity", "regState", "regPostal",
] as const;
const BOOL_FIELDS = ["womenOwned", "minorityOwned", "smallBusiness"] as const;

/** Only these keys can ever be written from a request. (The old route spread the whole body into the row.) */
function pickProfileFields(body: Record<string, unknown>): Prisma.SupplierOnboardingProfileUncheckedUpdateInput {
  const out: Record<string, unknown> = {};
  for (const k of STRING_FIELDS) if (typeof body[k] === "string") out[k] = (body[k] as string).trim().slice(0, 200);
  for (const k of BOOL_FIELDS) if (typeof body[k] === "boolean") out[k] = body[k];
  return out;
}

export type SaveProfileResult =
  | { ok: true; profile: SupplierOnboardingProfile; completionScore: number; requirements: ReturnType<typeof requirementsFor> }
  | { ok: false; status: number; error: string; validation?: Record<string, { valid: boolean; message?: string }> };

export async function saveOnboardingProfile(supplierId: string, body: Record<string, unknown>): Promise<SaveProfileResult> {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) return { ok: false, status: 404, error: "Not found" };

  const requestedCountry = typeof body.country === "string" ? body.country.trim() : "";
  if (requestedCountry && !SUPPORTED_COUNTRIES.includes(requestedCountry)) return { ok: false, status: 422, error: `Country must be one of: ${SUPPORTED_COUNTRIES.join(", ")}` };
  const country = requestedCountry || supplier.country || "Other";
  const reqs = requirementsFor(country);
  const fields = pickProfileFields(body);
  const existing = await prisma.supplierOnboardingProfile.findUnique({ where: { supplierId } });
  const merged = { ...(existing ?? {}), ...fields } as Record<string, unknown>; // what the profile will look like after this save

  const validation: Record<string, { valid: boolean; message?: string }> = {};
  for (const f of [...reqs.taxFields, ...reqs.bankFields]) {
    const v = merged[f.key];
    if (f.validator && typeof v === "string" && v.trim()) validation[f.key] = validateTaxOrBankField(f.validator, v);
  }
  const invalid = Object.entries(validation).filter(([, r]) => !r.valid);
  if (invalid.length > 0) return { ok: false, status: 422, error: invalid.map(([field, r]) => `${field}: ${r.message}`).join(", "), validation };

  const FIELDS = ["legalName", "businessType", ...reqs.taxFields.map(f => f.key), ...reqs.bankFields.map(f => f.key), "beneficiaryName", "regAddressLine1", "regCity", "regState", "regPostal"];
  const filled = FIELDS.filter(f => typeof merged[f] === "string" && String(merged[f]).trim()).length;
  const completionScore = Math.round((filled / FIELDS.length) * 100);

  const profile = await prisma.supplierOnboardingProfile.upsert({
    where: { supplierId },
    create: { supplierId, ...(fields as object), country, completionScore, validation },
    update: { ...fields, country, completionScore, validation, updatedAt: new Date() },
  });
  // Stages only ever move forward here, and never past review: reaching ACTIVE is a human approval.
  const idx = completionScore >= 80 ? 3 : completionScore >= 50 ? 2 : completionScore >= 20 ? 1 : 0;
  const current = supplier.onboardingStage ? STAGES.indexOf(supplier.onboardingStage as (typeof STAGES)[number]) : 0;
  await prisma.supplier.update({ where: { id: supplierId }, data: { country, ...(supplier.status === "PENDING_APPROVAL" && idx > current ? { onboardingStage: STAGES[idx] as never } : {}) } });
  await recomputeAndSaveSupplierRisk(supplierId);
  return { ok: true, profile, completionScore, requirements: reqs };
}

// ─── The organisation's own questionnaire (Admin → custom fields for suppliers) ───

function matchesConditions(conditions: unknown, ctx: Record<string, string | null | undefined>): boolean {
  if (!conditions || typeof conditions !== "object") return true;
  for (const [key, allowed] of Object.entries(conditions as Record<string, unknown>)) {
    if (!Array.isArray(allowed) || allowed.length === 0) continue;
    const val = ctx[key];
    if (!val || !allowed.includes(val)) return false;
  }
  return true;
}

/** The custom questions that apply to this supplier, given its category and conditions. */
export async function applicableQuestions(organizationId: string, supplier: Pick<Supplier, "category" | "country" | "riskLevel" | "tier">) {
  const all = await prisma.customField.findMany({ where: { organizationId, entity: "SUPPLIER", active: true }, orderBy: { sortOrder: "asc" } });
  const ctx = { country: supplier.country, riskLevel: supplier.riskLevel, tier: supplier.tier, businessType: null as string | null };
  return all.filter(f => (f.categories.length === 0 || (supplier.category != null && f.categories.includes(supplier.category))) && matchesConditions(f.conditions, ctx));
}

// ─── Checklist ───

export type ChecklistItem = { key: string; label: string; group: "Company & tax" | "Bank" | "Address" | "Documents" | "Risk declarations" | "Questions"; status: "done" | "missing" | "invalid"; detail?: string };
export type Checklist = { items: ChecklistItem[]; percent: number; missing: ChecklistItem[]; readyForReview: boolean };

/** Documents any vendor may add on top of the ones their country requires. */
export const OPTIONAL_DOC_TYPES = ["ISO_CERTIFICATE", "INSURANCE_CERTIFICATE", "MSME_CERTIFICATE", "OTHER"] as const;

export const DECLARATIONS = [
  { key: "hasInsurance", label: "We hold business / liability insurance" },
  { key: "hasBCP", label: "We have a business continuity / disaster recovery plan" },
  { key: "hasAntiBriberyPolicy", label: "We have a formal anti-bribery / anti-corruption policy" },
  { key: "hasLegalDisputes", label: "We have pending legal disputes or regulatory action", negative: true },
] as const;

/**
 * What still stands between this vendor and being reviewable. Purely deterministic: it only
 * counts what is actually on file, so "done" always means a real value or a real upload.
 */
export function computeChecklist(opts: {
  supplier: Pick<Supplier, "country">;
  profile: SupplierOnboardingProfile | null;
  documents: Pick<SupplierDocument, "type" | "status" | "rejectedNote" | "expiryDate">[];
  questions: { fieldKey: string; name: string; required: boolean }[];
  answers: Record<string, unknown> | null;
}): Checklist {
  const reqs = requirementsFor(opts.supplier.country);
  const p = (opts.profile ?? {}) as Record<string, unknown>;
  const validation = (opts.profile?.validation ?? {}) as Record<string, { valid: boolean; message?: string }>;
  const items: ChecklistItem[] = [];
  const has = (k: string) => typeof p[k] === "string" && String(p[k]).trim().length > 0;
  const field = (key: string, label: string, group: ChecklistItem["group"]) => {
    if (!has(key)) items.push({ key, label, group, status: "missing" });
    else if (validation[key]?.valid === false) items.push({ key, label, group, status: "invalid", detail: validation[key].message });
    else items.push({ key, label, group, status: "done" });
  };
  field("legalName", "Legal company name", "Company & tax");
  field("businessType", "Type of business", "Company & tax");
  for (const f of reqs.taxFields) field(f.key, f.label, "Company & tax");
  for (const f of reqs.bankFields) field(f.key, f.label, "Bank");
  field("beneficiaryName", "Account holder name", "Bank");
  field("regAddressLine1", "Registered address", "Address");
  field("regCity", "City", "Address");
  field("regState", "State / region", "Address");
  field("regPostal", "Postal code", "Address");

  const now = Date.now();
  for (const type of reqs.requiredDocs) {
    const mine = opts.documents.filter(d => d.type === type);
    const label = DOC_TYPE_LABELS[type] ?? type;
    const usable = mine.filter(d => d.status !== "REJECTED" && d.status !== "EXPIRED" && !(d.expiryDate && d.expiryDate.getTime() < now));
    if (usable.length > 0) items.push({ key: `doc:${type}`, label, group: "Documents", status: "done" });
    else if (mine.some(d => d.status === "REJECTED")) items.push({ key: `doc:${type}`, label, group: "Documents", status: "invalid", detail: mine.find(d => d.status === "REJECTED")?.rejectedNote ?? "Rejected — please upload a corrected copy" });
    else if (mine.length > 0) items.push({ key: `doc:${type}`, label, group: "Documents", status: "invalid", detail: "Expired — please upload a current copy" });
    else items.push({ key: `doc:${type}`, label, group: "Documents", status: "missing" });
  }

  const decl = (opts.profile?.riskDeclarations ?? null) as Record<string, unknown> | null;
  for (const d of DECLARATIONS) items.push({ key: `decl:${d.key}`, label: d.label, group: "Risk declarations", status: decl && typeof decl[d.key] === "boolean" ? "done" : "missing" });

  for (const q of opts.questions.filter(q => q.required)) {
    const a = opts.answers?.[q.fieldKey];
    items.push({ key: `q:${q.fieldKey}`, label: q.name, group: "Questions", status: a != null && String(a).trim() !== "" ? "done" : "missing" });
  }

  const done = items.filter(i => i.status === "done").length;
  const missing = items.filter(i => i.status !== "done");
  return { items, percent: items.length ? Math.round((done / items.length) * 100) : 100, missing, readyForReview: missing.length === 0 };
}

/** Loads everything and computes the checklist for one supplier. */
export async function checklistFor(supplierId: string): Promise<{ supplier: Supplier; profile: SupplierOnboardingProfile | null; documents: SupplierDocument[]; questions: Awaited<ReturnType<typeof applicableQuestions>>; checklist: Checklist } | null> {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) return null;
  const [profile, documents, questions] = await Promise.all([
    prisma.supplierOnboardingProfile.findUnique({ where: { supplierId } }),
    prisma.supplierDocument.findMany({ where: { supplierId }, orderBy: { createdAt: "desc" } }),
    applicableQuestions(supplier.organizationId, supplier),
  ]);
  const checklist = computeChecklist({ supplier, profile, documents, questions: questions.map(q => ({ fieldKey: q.fieldKey, name: q.name, required: q.required })), answers: (supplier.customFieldAnswers ?? null) as Record<string, unknown> | null });
  return { supplier, profile, documents, questions, checklist };
}
