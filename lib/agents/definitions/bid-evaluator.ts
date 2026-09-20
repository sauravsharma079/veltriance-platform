import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scoreBids, WEIGHTS } from "@/lib/sourcing";
import { defineTool, type AgentDef } from "@/lib/agents/runtime";

const getBids = defineTool({
  name: "get_bids",
  description: "Loads everything needed to compare bids on an event: the items with the buyer's target prices, each submitted bid (per-line prices, lead time, terms, answers), each supplier's risk and rating, the deterministic scores, and who declined or didn't respond.",
  risk: "read",
  input: z.object({ eventId: z.string().min(1) }),
  async run(ctx, input) {
    const e = await prisma.sourcingEvent.findFirst({
      where: { id: input.eventId, organizationId: ctx.organizationId },
      include: {
        items: { orderBy: { sequence: "asc" } },
        invites: { include: { supplier: { select: { name: true, riskLevel: true, riskScore: true, rating: true, status: true } }, bid: { include: { lines: true } } } },
      },
    });
    if (!e) throw new Error("Event not found");
    const submitted = e.invites.filter(i => i.bid);
    const scores = scoreBids(submitted.map(i => ({ inviteId: i.id, total: Number(i.bid!.totalAmount), leadTimeDays: i.bid!.leadTimeDays, riskLevel: i.supplier?.riskLevel ?? null })));
    const questions = (Array.isArray(e.questions) ? e.questions : []) as { id: string; text: string }[];
    return {
      eventId: e.id, number: e.eventNumber, title: e.title, status: e.status, currency: e.currency,
      scoringWeights: WEIGHTS,
      items: e.items.map(i => ({ id: i.id, description: i.description, quantity: Number(i.quantity), targetPrice: i.targetPrice ? Number(i.targetPrice) : null })),
      bids: submitted.map(i => {
        const s = scores.find(x => x.inviteId === i.id)!;
        return {
          inviteId: i.id, supplier: i.name, supplierStatus: i.supplier?.status ?? "not in supplier list", riskLevel: i.supplier?.riskLevel ?? "unknown", rating: i.supplier?.rating ?? null,
          total: Number(i.bid!.totalAmount), leadTimeDays: i.bid!.leadTimeDays, paymentTerms: i.bid!.paymentTerms, validityDays: i.bid!.validityDays,
          notes: i.bid!.notes?.slice(0, 600) ?? null, revision: i.bid!.revision,
          lines: i.bid!.lines.map(l => ({ item: e.items.find(x => x.id === l.itemId)?.description, unitPrice: Number(l.unitPrice) })),
          answers: Object.entries((i.bid!.answers ?? {}) as Record<string, string>).map(([id, a]) => ({ question: questions.find(q => q.id === id)?.text ?? id, answer: a.slice(0, 500) })),
          score: Math.round(s.score * 10) / 10, rank: s.rank, isLowestPrice: s.isLowest,
        };
      }),
      declined: e.invites.filter(i => i.status === "DECLINED").map(i => i.name),
      noResponse: e.invites.filter(i => !i.bid && i.status !== "DECLINED").map(i => i.name),
    };
  },
});

const saveEvaluation = defineTool({
  name: "save_evaluation",
  description: "Records your evaluation on the event so the buyer sees it beside the comparison. The buyer makes the award decision; you only recommend. recommendedInviteId must be an inviteId from get_bids.",
  risk: "write",
  input: z.object({
    eventId: z.string().min(1),
    summary: z.string().min(40).max(2000),
    recommendedInviteId: z.string().min(1),
    notes: z.array(z.object({ inviteId: z.string().min(1), note: z.string().min(5).max(500) })).max(20),
  }),
  async run(ctx, input) {
    const e = await prisma.sourcingEvent.findFirst({ where: { id: input.eventId, organizationId: ctx.organizationId }, include: { invites: { where: { bid: { isNot: null } }, select: { id: true } } } });
    if (!e) throw new Error("Event not found");
    if (e.status !== "EVALUATION") throw new Error("An evaluation can only be saved once bidding has closed");
    const valid = new Set(e.invites.map(i => i.id));
    if (!valid.has(input.recommendedInviteId)) throw new Error("recommendedInviteId is not a bidder on this event");
    const notes = input.notes.filter(n => valid.has(n.inviteId));
    await prisma.sourcingEvent.update({
      where: { id: e.id },
      data: { evaluation: { summary: input.summary, recommendedInviteId: input.recommendedInviteId, notes, evaluatedAt: new Date().toISOString(), by: "Bid Evaluator agent" } as Prisma.InputJsonValue },
    });
    return { saved: true, notes: notes.length };
  },
});

export const bidEvaluator: AgentDef = {
  key: "bid-evaluator",
  title: "Bid Evaluator",
  description: "Compares the bids on an event — price, lead time, terms, answers and supplier risk — and recommends a winner with its reasoning. The buyer still decides the award.",
  module: "SOURCING",
  schedule: null,
  maxSteps: 5,
  requireWriteBeforeFinish: true,
  timeBudgetMs: 120_000,
  launch: { label: "Open a sourcing event to use it", href: "/dashboard/sourcing" },
  inputSchema: z.object({ eventId: z.string().min(1) }),
  instructions: `You evaluate supplier bids for a buyer. Call get_bids, then call save_evaluation ONCE.
Base your recommendation on the facts returned, starting from the deterministic score (price ${WEIGHTS.price}%, lead time ${WEIGHTS.leadTime}%, supplier risk ${WEIGHTS.risk}%). You may recommend a bid other than the top-scored one, but say exactly why. Look for and mention: a price far below the buyer's target or the other bids (a possible mistake or a corner being cut), missing lead times, short bid validity, unfavourable payment terms, high or unknown supplier risk, a blocked or inactive supplier, concerning answers to the questions, and bids that miss items. Keep the summary to a few short paragraphs a busy buyer can act on, and add a short note for each bidder. Use only numbers from the tool result. You recommend; you do not award.`,
  kickoff: input => `Event ID: ${input?.eventId}. Evaluate the bids and save your recommendation.`,
  tools: [getBids, saveEvaluation],
};
