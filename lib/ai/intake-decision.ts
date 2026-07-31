import { prisma } from "@/lib/prisma";
import { resolveApprovalSteps } from "@/lib/approval-matrix";
import type { ExtractedRequirement } from "@/lib/ai/nlu";

// The "should we buy from catalog / reuse a supplier / go find one" decision tree
// from the intake spec — built on data that actually exists in this database
// (Catalog, CatalogItem, Supplier, ApprovalRule), not fabricated market data.

export type IntakeDecision = {
  catalogMatch: { catalogId: string; itemId: string; itemName: string; sku: string; unitPrice: number; currency: string; supplierName: string | null } | null;
  supplierMatches: { id: string; name: string; code: string | null; category: string | null; rating: number | null }[];
  needsSourcing: boolean;
  estimatedAmount: number | null;
  approvalPreview: { stepType: string; stepLabel: string | null }[] | null;
};

export async function decideIntakeRoute(opts: {
  organizationId: string; department: string | null; extracted: ExtractedRequirement;
}): Promise<IntakeDecision> {
  const { organizationId, extracted } = opts;
  const category = extracted.category;

  const catalogItem = category
    ? await prisma.catalogItem.findFirst({
        where: {
          active: true, category: { equals: category, mode: "insensitive" },
          catalog: { organizationId, status: "ACTIVE", type: "HOSTED" },
        },
        include: { catalog: true, supplier: { select: { name: true } } },
        orderBy: { unitPrice: "asc" },
      })
    : null;

  const suppliers = category
    ? await prisma.supplier.findMany({
        where: { organizationId, status: "ACTIVE", category: { equals: category, mode: "insensitive" } },
        select: { id: true, name: true, code: true, category: true, rating: true },
        orderBy: [{ preferred: "desc" }, { rating: "desc" }],
        take: 5,
      })
    : [];

  const estimatedAmount = catalogItem && extracted.quantity
    ? Number(catalogItem.unitPrice) * extracted.quantity
    : null;

  let approvalPreview: IntakeDecision["approvalPreview"] = null;
  if (estimatedAmount != null) {
    const steps = await resolveApprovalSteps(organizationId, estimatedAmount, category, opts.department);
    approvalPreview = steps.map(s => ({ stepType: s.stepType, stepLabel: s.stepLabel }));
  }

  return {
    catalogMatch: catalogItem ? {
      catalogId: catalogItem.catalogId, itemId: catalogItem.id, itemName: catalogItem.name,
      sku: catalogItem.sku, unitPrice: Number(catalogItem.unitPrice), currency: catalogItem.currency,
      supplierName: catalogItem.supplier?.name ?? null,
    } : null,
    supplierMatches: suppliers,
    needsSourcing: !catalogItem && suppliers.length === 0,
    estimatedAmount,
    approvalPreview,
  };
}
