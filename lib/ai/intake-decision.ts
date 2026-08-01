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

const STOPWORDS = new Set([
  "i", "need", "needs", "needed", "want", "wants", "to", "purchase", "buy", "buying",
  "for", "the", "a", "an", "of", "please", "urgent", "urgently", "asap", "some", "more",
  "new", "order", "get", "us", "our", "deliver", "delivered", "delivery", "before",
  "after", "next", "this", "in", "at", "and", "or", "with", "by", "on",
]);

function normalize(word: string): string {
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

export function significantWords(text: string): string[] {
  return Array.from(new Set(
    (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
      .filter(w => !/^\d+$/.test(w)) // bare numbers are quantities/model numbers, not product keywords
      .map(normalize)
      .filter(w => w.length > 2 && !STOPWORDS.has(w))
  ));
}

export async function decideIntakeRoute(opts: {
  organizationId: string; department: string | null; extracted: ExtractedRequirement;
}): Promise<IntakeDecision> {
  const { organizationId, extracted } = opts;
  const category = extracted.category;

  // Match on the actual product the requestor typed, not just the category —
  // a category can hold many unrelated items (e.g. "IT Hardware" containing both
  // laptops and a mouse/keyboard combo), and picking the cheapest one regardless
  // of relevance previously surfaced wrong items ("200 laptops" -> a Logitech combo).
  const keywords = significantWords(extracted.title);
  const candidateItems = category
    ? await prisma.catalogItem.findMany({
        where: {
          active: true, category: { equals: category, mode: "insensitive" },
          catalog: { organizationId, status: "ACTIVE", type: "HOSTED" },
        },
        include: { catalog: true, supplier: { select: { name: true } } },
        orderBy: { unitPrice: "asc" },
        take: 50,
      })
    : [];

  let catalogItem: (typeof candidateItems)[number] | null = null;
  if (candidateItems.length === 1) {
    // Unambiguous — only one item in the category, no relevance signal needed.
    catalogItem = candidateItems[0];
  } else if (candidateItems.length > 1 && keywords.length > 0) {
    const scored = candidateItems
      .map(item => ({
        item,
        score: keywords.filter(k => significantWords(`${item.name} ${item.description ?? ""}`).includes(k)).length,
      }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || Number(a.item.unitPrice) - Number(b.item.unitPrice));
    catalogItem = scored[0]?.item ?? null;
  }
  // If there are multiple items in the category and none match the requested
  // product by name, leave catalogItem null rather than guessing — the requestor
  // falls through to the supplier-match / needs-sourcing branch instead.

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
