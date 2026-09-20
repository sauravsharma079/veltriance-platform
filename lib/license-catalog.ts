// What can be sold. Kept free of server imports so the sidebar and admin UI can
// share it. Enforcement lives in lib/licensing.ts.

export type LicenseModuleKey = "INTAKE_TO_PO" | "SUPPLIER_RISK" | "SOURCING" | "CONTRACTS" | "AGENTS" | "INVOICING";

export const MODULE_CATALOG: Record<LicenseModuleKey, { label: string; description: string; available: boolean }> = {
  INTAKE_TO_PO:  { label: "Intake to Purchase Order", description: "Requisitions, approvals, catalogs and purchase orders", available: true },
  SUPPLIER_RISK: { label: "Supplier Onboarding & Risk", description: "Onboarding, documents, risk assessment and monitoring", available: true },
  SOURCING:      { label: "Sourcing", description: "RFx events, bidding and award", available: true },
  CONTRACTS:     { label: "Contracts", description: "Negotiation, e-signature and published contract repository", available: true },
  INVOICING:     { label: "Receiving & Invoice Matching", description: "Goods receipt, invoice capture, three-way match and payment tracking", available: true },
  AGENTS:        { label: "Autonomous Agents", description: "Agents that run workflows with minimal human touch", available: true },
};

export const ALL_MODULES = Object.keys(MODULE_CATALOG) as LicenseModuleKey[];

// Bundles offered to customers. "CUSTOM" is any hand-picked combination.
export const PLANS: Record<string, { label: string; modules: LicenseModuleKey[] }> = {
  INTAKE_TO_PO:  { label: "Intake to PO",  modules: ["INTAKE_TO_PO"] },
  PROCURE_PLUS:  { label: "Procure+",      modules: ["INTAKE_TO_PO", "SUPPLIER_RISK"] },
  FULL_SUITE:    { label: "Full Suite",    modules: ALL_MODULES },
};

export function planLabel(plan: string): string {
  return PLANS[plan]?.label ?? "Custom";
}
