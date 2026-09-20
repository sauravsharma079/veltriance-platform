import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { defineTool, type AgentDef } from "@/lib/agents/runtime";

const AGENT_NAME = "Veltriance Agent";
const TAG = "Renewal alert";
const COOLDOWN_DAYS = 14;
const LEAD_DAYS = 30; // start flagging this long before the notice deadline

const daysBetween = (a: Date, b: Date) => Math.ceil((a.getTime() - b.getTime()) / 86_400_000);

const listAttention = defineTool({
  name: "list_contracts_needing_attention",
  description: "Lists active contracts nearing the date by which they must be renewed or cancelled (end date minus notice period, plus a lead time), that haven't been flagged in the last two weeks.",
  risk: "read",
  input: z.object({}),
  async run(ctx) {
    const now = new Date();
    const contracts = await prisma.contract.findMany({
      where: {
        organizationId: ctx.organizationId, status: "ACTIVE", endDate: { not: null },
        comments: { none: { authorType: "AGENT", body: { startsWith: TAG }, createdAt: { gte: new Date(Date.now() - COOLDOWN_DAYS * 86_400_000) } } },
      },
      select: { id: true, contractNumber: true, title: true, endDate: true, noticeDays: true, autoRenew: true, value: true, currency: true, supplier: { select: { name: true } }, owner: { select: { name: true } } },
      orderBy: { endDate: "asc" }, take: 200,
    });
    const due = contracts.filter(c => daysBetween(c.endDate!, now) <= c.noticeDays + LEAD_DAYS).slice(0, 20);
    return {
      count: due.length,
      contracts: due.map(c => {
        const daysToEnd = daysBetween(c.endDate!, now);
        return {
          contractId: c.id, number: c.contractNumber, title: c.title, supplier: c.supplier?.name ?? null, owner: c.owner.name,
          endDate: c.endDate!.toISOString().slice(0, 10), daysToEnd, noticeDays: c.noticeDays,
          daysToNoticeDeadline: daysToEnd - c.noticeDays, autoRenews: c.autoRenew,
          value: c.value ? `${c.currency} ${Number(c.value)}` : null,
        };
      }),
    };
  },
});

const flagRenewal = defineTool({
  name: "flag_contract_renewal",
  description: "Adds an internal renewal alert to a contract's thread so its owner sees it. Write 2-3 sentences: what ends when, the notice deadline, whether it auto-renews, and the recommended next step (renegotiate, renew, or let it lapse).",
  risk: "write",
  input: z.object({ contractId: z.string().min(1), message: z.string().min(20).max(800) }),
  async run(ctx, input) {
    const c = await prisma.contract.findFirst({ where: { id: input.contractId, organizationId: ctx.organizationId }, select: { id: true, status: true, currentVersion: true } });
    if (!c) throw new Error("Contract not found");
    if (c.status !== "ACTIVE") throw new Error("Only active contracts get renewal alerts");
    const recent = await prisma.contractComment.findFirst({ where: { contractId: c.id, authorType: "AGENT", body: { startsWith: TAG }, createdAt: { gte: new Date(Date.now() - COOLDOWN_DAYS * 86_400_000) } } });
    if (recent) throw new Error(`Already flagged in the last ${COOLDOWN_DAYS} days`);
    const comment = await prisma.contractComment.create({ data: { contractId: c.id, authorType: "AGENT", authorName: AGENT_NAME, body: `${TAG}: ${input.message}`, internal: true, versionNumber: c.currentVersion } });
    return { commentId: comment.id };
  },
});

export const contractRenewalWatch: AgentDef = {
  key: "contract-renewal-watch",
  title: "Contract Renewal Watch",
  description: "Watches active contracts and alerts their owners ahead of renewal and notice deadlines, so nothing auto-renews or lapses by surprise.",
  module: "CONTRACTS",
  schedule: "daily",
  maxSteps: 12,
  instructions: `You make sure no contract renews or lapses by surprise. List the contracts needing attention, then flag each one with a short, specific alert. Be factual — use only the numbers the tool returned. If a notice deadline has already passed, say so plainly. Flag each contract once.`,
  kickoff: () => "Check which active contracts need a renewal alert and flag them.",
  tools: [listAttention, flagRenewal],
};
