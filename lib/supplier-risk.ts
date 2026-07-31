import { prisma } from "@/lib/prisma";
import type { Supplier, SupplierOnboardingProfile, SupplierDocument } from "@prisma/client";
import { requirementsFor } from "@/lib/onboarding-requirements";

// Deterministic, explainable risk & compliance scoring from data actually present in
// this database — no black-box ML call, no fabricated numbers. riskScore is 0-100
// where HIGHER = riskier (matches the existing red risk bar on the supplier detail
// page). complianceScore is 0-100 where HIGHER = more compliant.
//
// Only domains backed by real signals in this schema are scored. The PRD calls for
// 15 risk domains (Financial, Cyber, Sanctions, ESG, Operational, Legal, Geographic,
// Reputational, InfoSec, Data Privacy, Business Continuity, Anti-Bribery, Modern
// Slavery, Insurance, Health & Safety) — most of those need a connected external data
// source (sanctions/PEP screening API, ESG rating provider, cyber rating provider,
// insurance certificate tracker) that isn't configured here. Rather than inventing
// plausible-looking numbers for those, they're listed as `unscored` with the reason,
// so the UI can say "not assessed — connect a provider" instead of lying.

// Illustrative starter list only — not a substitute for a licensed sanctions/embargo
// screening provider (OFAC SDN, UN, EU consolidated lists, etc).
const HIGH_RISK_COUNTRIES = new Set(["North Korea", "Iran", "Syria", "Cuba", "Russia", "Belarus", "Myanmar"]);

const ALWAYS_UNSCORED_DOMAINS = [
  { domain: "Cyber Security", reason: "requires a connected cyber-risk rating provider (e.g. BitSight, SecurityScorecard)" },
  { domain: "ESG", reason: "requires a connected ESG data provider (e.g. EcoVadis)" },
  { domain: "Reputational", reason: "requires connected adverse-media / news screening" },
  { domain: "Information Security", reason: "requires SOC2/ISO27001 certificate verification workflow" },
  { domain: "Data Privacy", reason: "requires GDPR/DPA questionnaire responses" },
  { domain: "Modern Slavery", reason: "requires a supply-chain transparency audit" },
  { domain: "Health & Safety", reason: "requires H&S questionnaire responses" },
];

export type RiskDomain = { domain: string; score: number; weight: number; rationale: string[] };
export type RiskBreakdown = {
  computedAt: string;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  complianceScore: number;
  domains: RiskDomain[];
  unscored: { domain: string; reason: string }[];
};

function levelFor(score: number): RiskBreakdown["riskLevel"] {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

export function computeSupplierRisk(
  supplier: Supplier,
  profile: SupplierOnboardingProfile | null,
  documents: SupplierDocument[]
): RiskBreakdown {
  // ── Financial ──────────────────────────────────────────────────────────
  const financialRationale: string[] = [];
  let financial = 0;
  const hasTaxId = !!(supplier.taxId || profile?.panNumber || profile?.gstNumber);
  if (!hasTaxId) { financial += 40; financialRationale.push("No tax ID on file."); }
  const hasBank = !!(supplier.bankAccountNumber || profile?.accountNumber);
  if (!hasBank) { financial += 30; financialRationale.push("No bank account on file."); }
  const invalidFields = Object.entries((profile?.validation as Record<string, { valid: boolean }> | null) ?? {}).filter(([, r]) => r && r.valid === false);
  if (invalidFields.length > 0) { financial += 30; financialRationale.push(`${invalidFields.length} tax/bank field(s) failed format validation: ${invalidFields.map(([k]) => k).join(", ")}.`); }
  if (financialRationale.length === 0) financialRationale.push("Tax ID and bank details on file, no validation failures.");
  financial = Math.min(100, financial);

  // ── Compliance & Documentation ────────────────────────────────────────
  const requiredDocTypes = requirementsFor(supplier.country).requiredDocs;
  const docRationale: string[] = [];
  let docs = 0;
  const byType = new Map(documents.map(d => [d.type, d]));
  const missing = requiredDocTypes.filter(t => !byType.has(t));
  if (missing.length > 0) { docs += missing.length * 20; docRationale.push(`Missing required document(s) for ${supplier.country ?? "this supplier's country"}: ${missing.join(", ")}.`); }
  const rejected = documents.filter(d => d.status === "REJECTED");
  if (rejected.length > 0) { docs += rejected.length * 15; docRationale.push(`${rejected.length} document(s) rejected.`); }
  const expired = documents.filter(d => d.status === "EXPIRED" || (d.expiryDate && d.expiryDate < new Date()));
  if (expired.length > 0) { docs += expired.length * 20; docRationale.push(`${expired.length} document(s) expired.`); }
  const pending = documents.filter(d => d.status === "PENDING");
  if (pending.length > 0) { docs += pending.length * 5; docRationale.push(`${pending.length} document(s) awaiting verification.`); }
  if (docRationale.length === 0) docRationale.push("All required documents present and verified.");
  docs = Math.min(100, docs);

  // ── Geographic & Sanctions Exposure ──────────────────────────────────
  const geoRationale: string[] = [];
  let geo = 5;
  if (!supplier.country) { geo = 15; geoRationale.push("Country not on file — geographic exposure can't be assessed."); }
  else if (HIGH_RISK_COUNTRIES.has(supplier.country)) { geo = 50; geoRationale.push(`${supplier.country} appears on the basic high-risk/embargoed country watchlist — this is an illustrative list only, not a licensed OFAC/EU/UN sanctions screen.`); }
  else geoRationale.push(`${supplier.country} not on the basic high-risk watchlist (illustrative screen only — connect a licensed sanctions provider for real coverage).`);

  // ── Operational Track Record ─────────────────────────────────────────
  const opRationale: string[] = [];
  let operational = 10;
  const metrics: [string, number | null][] = [
    ["on-time delivery", supplier.onTimeDelivery], ["quality score", supplier.qualityScore],
    ["invoice accuracy", supplier.invoiceAccuracy], ["responsiveness", supplier.responsivenessScore],
  ];
  const weakMetrics = metrics.filter(([, v]) => v != null && v < 60);
  if (weakMetrics.length > 0) { operational += weakMetrics.length * 15; opRationale.push(`Below-threshold performance: ${weakMetrics.map(([n, v]) => `${n} ${v}`).join(", ")}.`); }
  const hasHistory = metrics.some(([, v]) => v != null);
  const ageDays = (Date.now() - supplier.createdAt.getTime()) / 86400000;
  if (!hasHistory && ageDays < 90) { operational += 20; opRationale.push("No performance history yet and onboarded recently — unproven track record."); }
  if (opRationale.length === 0) opRationale.push("No performance red flags.");
  operational = Math.min(100, operational);

  const domains: RiskDomain[] = [
    { domain: "Financial", score: financial, weight: 0.25, rationale: financialRationale },
    { domain: "Compliance & Documentation", score: docs, weight: 0.25, rationale: docRationale },
    { domain: "Geographic & Sanctions Exposure", score: geo, weight: 0.15, rationale: geoRationale },
    { domain: "Operational Track Record", score: operational, weight: 0.15, rationale: opRationale },
  ];

  // ── Self-Declared Risk Factors (insurance, BCP, anti-bribery policy, legal disputes) ──
  // Real signal, but self-attested by the supplier during onboarding rather than
  // independently verified — scored once they've answered the risk questionnaire,
  // otherwise listed as unscored rather than assumed clean.
  const unscored = [...ALWAYS_UNSCORED_DOMAINS];
  const decl = profile?.riskDeclarations as Record<string, boolean> | null;
  if (decl && typeof decl === "object") {
    const declRationale: string[] = [];
    let selfDeclared = 0;
    if (decl.hasInsurance === false) { selfDeclared += 25; declRationale.push("Supplier declared no business/liability insurance."); }
    if (decl.hasBCP === false) { selfDeclared += 15; declRationale.push("Supplier declared no business continuity / disaster recovery plan."); }
    if (decl.hasAntiBriberyPolicy === false) { selfDeclared += 15; declRationale.push("Supplier declared no formal anti-bribery / anti-corruption policy."); }
    if (decl.hasLegalDisputes === true) { selfDeclared += 35; declRationale.push("Supplier declared pending legal disputes or regulatory action."); }
    if (declRationale.length === 0) declRationale.push("Supplier declared insurance coverage, a business continuity plan, an anti-bribery policy, and no pending legal disputes.");
    declRationale.push("Self-attested by the supplier during onboarding, not independently verified.");
    domains.push({ domain: "Self-Declared Risk Factors", score: Math.min(100, selfDeclared), weight: 0.2, rationale: declRationale });
  } else {
    unscored.unshift({ domain: "Self-Declared Risk Factors (insurance, BCP, anti-bribery, legal disputes)", reason: "supplier hasn't completed the onboarding risk questionnaire yet" });
  }

  const totalWeight = domains.reduce((sum, d) => sum + d.weight, 0);
  const riskScore = Math.round(domains.reduce((sum, d) => sum + d.score * d.weight, 0) / totalWeight);

  const verifiedRequired = requiredDocTypes.filter(t => byType.get(t)?.status === "VERIFIED").length;
  let complianceScore = requiredDocTypes.length > 0 ? Math.round((verifiedRequired / requiredDocTypes.length) * 100) : 100;
  complianceScore -= rejected.length * 10 + expired.length * 15;
  complianceScore = Math.max(0, Math.min(100, complianceScore));

  return {
    computedAt: new Date().toISOString(),
    riskScore,
    riskLevel: levelFor(riskScore),
    complianceScore,
    domains,
    unscored,
  };
}

export async function recomputeAndSaveSupplierRisk(supplierId: string): Promise<RiskBreakdown | null> {
  const [supplier, profile, documents] = await Promise.all([
    prisma.supplier.findUnique({ where: { id: supplierId } }),
    prisma.supplierOnboardingProfile.findUnique({ where: { supplierId } }),
    prisma.supplierDocument.findMany({ where: { supplierId } }),
  ]);
  if (!supplier) return null;
  const breakdown = computeSupplierRisk(supplier, profile, documents);
  await prisma.supplier.update({
    where: { id: supplierId },
    data: {
      riskScore: breakdown.riskScore,
      riskLevel: breakdown.riskLevel,
      complianceScore: breakdown.complianceScore,
      lastRiskReview: new Date(),
      riskBreakdown: breakdown as object,
    },
  });
  return breakdown;
}
