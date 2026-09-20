import type { SourcingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publicBaseUrl } from "@/lib/contracts";

export const EVENT_TYPES = ["RFQ", "RFP", "RFI"] as const;

export async function nextEventNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.sourcingEvent.count({ where: { organizationId, eventNumber: { startsWith: `RFX-${year}-` } } });
  return `RFX-${year}-${String(count + 1).padStart(5, "0")}`;
}

/** Where each action may start from. Anything not listed is refused. */
export const TRANSITIONS: Record<string, { from: SourcingStatus[]; to: SourcingStatus }> = {
  publish: { from: ["DRAFT"], to: "OPEN" },
  close:   { from: ["OPEN"], to: "EVALUATION" },
  award:   { from: ["EVALUATION"], to: "AWARDED" },
  cancel:  { from: ["DRAFT", "OPEN", "EVALUATION"], to: "CANCELLED" },
};

export function bidUrl(token: string, fallbackOrigin?: string): string {
  return `${publicBaseUrl(fallbackOrigin)}/bid/${token}`;
}

/** Moves OPEN events whose deadline has passed to EVALUATION. Deterministic — no model involved. */
export async function closeOverdueEvents(organizationId?: string) {
  const res = await prisma.sourcingEvent.updateMany({
    where: { status: "OPEN", deadline: { lt: new Date() }, ...(organizationId && { organizationId }) },
    data: { status: "EVALUATION" },
  });
  return res.count;
}

// ─── Bid scoring ─────────────────────────────────────────────────────────────
// Deliberately simple and explainable: a buyer can see exactly why one bid ranks
// above another. The evaluator agent adds judgement on top; it doesn't replace this.

export const WEIGHTS = { price: 60, leadTime: 20, risk: 20 } as const;
const RISK_SCORE: Record<string, number> = { LOW: 100, MEDIUM: 70, HIGH: 40, CRITICAL: 10 };

export type ScoredBid = { inviteId: string; total: number; leadTimeDays: number | null; riskLevel: string | null; priceScore: number; leadTimeScore: number; riskScore: number; score: number; rank: number; isLowest: boolean };

export function scoreBids(bids: { inviteId: string; total: number; leadTimeDays: number | null; riskLevel: string | null }[]): ScoredBid[] {
  if (bids.length === 0) return [];
  const lowest = Math.min(...bids.map(b => b.total));
  const leads = bids.map(b => b.leadTimeDays).filter((n): n is number => n != null && n > 0);
  const fastest = leads.length ? Math.min(...leads) : null;
  const scored = bids.map(b => {
    const priceScore = b.total > 0 ? (lowest / b.total) * 100 : 0;
    // A bid that doesn't state a lead time gets a neutral 50 rather than a free pass.
    const leadTimeScore = b.leadTimeDays && fastest ? (fastest / b.leadTimeDays) * 100 : 50;
    const riskScore = b.riskLevel ? (RISK_SCORE[b.riskLevel] ?? 60) : 60;
    const score = (priceScore * WEIGHTS.price + leadTimeScore * WEIGHTS.leadTime + riskScore * WEIGHTS.risk) / 100;
    return { ...b, priceScore, leadTimeScore, riskScore, score, rank: 0, isLowest: b.total === lowest };
  }).sort((a, b) => b.score - a.score);
  scored.forEach((b, i) => { b.rank = i + 1; });
  return scored;
}
