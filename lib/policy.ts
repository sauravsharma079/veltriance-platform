import { z } from "zod";
import { ApprovalStepType } from "@prisma/client";
import type { ApprovalStepDef } from "@/lib/approval-matrix";
import type { BudgetCheckResult } from "@/lib/budget";

// The policy engine decides, at the moment a request is submitted, how it should travel: which approvals it
// needs, whether it can skip them, and whether it should go to competitive quotes instead of straight to a PO.
// It is rules, not a model: the same request always gets the same answer, and every outcome carries the reason
// in plain words for the approver and the audit trail.

const money = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const lc = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const inList = (list: string[] | undefined, v: string | null) => !list || list.length === 0 || (!!v && list.some(x => lc(x) === lc(v)));

export const RULE_TYPES = {
  AUTO_APPROVE: {
    label: "Auto-approve low-value orders",
    describe: "Skip approvals when the value is small and every supplier is already trusted.",
    params: z.object({ maxAmount: z.number().positive(), requirePreferredSupplier: z.boolean().default(true), categories: z.array(z.string()).default([]) }),
  },
  REQUIRE_SOURCING: {
    label: "Require competitive quotes",
    describe: "Above a value, go out to several suppliers instead of ordering straight away — unless there's a contract.",
    params: z.object({ minAmount: z.number().positive(), categories: z.array(z.string()).default([]), exemptIfContracted: z.boolean().default(true) }),
  },
  SPLIT_ORDER: {
    label: "Catch split purchases",
    describe: "Flag someone placing several small orders that together would have needed approval.",
    params: z.object({ thresholdAmount: z.number().positive(), windowDays: z.number().int().min(1).max(365).default(30) }),
  },
  CATEGORY_STEP: {
    label: "Always add an approval for a category",
    describe: "e.g. all software or consulting spend also needs Procurement or Finance.",
    params: z.object({ categories: z.array(z.string()).min(1), stepType: z.enum(["PROCUREMENT", "FINANCE", "DIRECTOR"]) }),
  },
} as const;
export type RuleType = keyof typeof RULE_TYPES;

export type PolicyRuleRow = { id: string; type: string; name: string; params: unknown };
export type RequestFacts = { amount: number; currency: string; category: string | null; department: string | null; requestorId: string; supplierIds: string[] };
export type PolicyFacts = {
  suppliers: Record<string, { status: string; preferred: boolean }>;
  contractedSupplierIds: string[];
  /** The requester's other live requests inside the look-back window. */
  recent: { amount: number; category: string | null; supplierIds: string[]; ageDays: number }[];
};
export type PolicyDecision = {
  steps: ApprovalStepDef[]; autoApproved: boolean; requireSourcing: boolean; blocked: string | null;
  flags: { code: string; message: string }[]; notes: string[];
};

function addStep(steps: ApprovalStepDef[], type: ApprovalStepType, label: string) {
  if (steps.some(s => s.stepType === type)) return false;
  steps.push({ stepType: type, stepLabel: label, sequence: Math.max(0, ...steps.map(s => s.sequence)) + 1, assignedUserId: null, approverUserIds: [], approverMode: "ANY" });
  return true;
}

/** Pure. `baseSteps` is what the normal approval matrix produced; the policy engine adjusts it. */
export function evaluatePolicies(rules: PolicyRuleRow[], req: RequestFacts, facts: PolicyFacts, baseSteps: ApprovalStepDef[], budget: BudgetCheckResult | null): PolicyDecision {
  const d: PolicyDecision = { steps: baseSteps.map(s => ({ ...s })), autoApproved: false, requireSourcing: false, blocked: null, flags: [], notes: [] };
  let touched = false; // a rule added an approval or raised a flag, so this request can't be waved through

  // Malformed rule parameters are skipped rather than crashing every submission.
  const parsed = rules.flatMap(r => {
    const def = RULE_TYPES[r.type as RuleType];
    if (!def) return [];
    const p = def.params.safeParse(r.params);
    return p.success ? [{ rule: r, type: r.type as RuleType, p: p.data as Record<string, unknown> }] : [];
  });

  // 1. Categories that always need a particular approver.
  for (const { rule, type, p } of parsed) if (type === "CATEGORY_STEP" && inList(p.categories as string[], req.category)) {
    if (addStep(d.steps, p.stepType as ApprovalStepType, `Policy: ${rule.name}`)) { touched = true; d.notes.push(`${req.category} spend needs ${String(p.stepType).toLowerCase()} approval (${rule.name}).`); }
  }

  // 2. Split purchases: small now, but together with recent ones it would have crossed the threshold.
  for (const { type, p } of parsed) if (type === "SPLIT_ORDER") {
    const threshold = p.thresholdAmount as number, window = p.windowDays as number;
    const related = facts.recent.filter(x => x.ageDays <= window && (lc(x.category) === lc(req.category) || x.supplierIds.some(s => req.supplierIds.includes(s))));
    const total = related.reduce((s, x) => s + x.amount, 0) + req.amount;
    if (req.amount < threshold && related.length > 0 && total >= threshold) {
      const m = `Looks like a split purchase: ${related.length} other request${related.length > 1 ? "s" : ""} from the same requester in the last ${window} days bring the total to ${req.currency} ${money(total)}, above the ${money(threshold)} limit.`;
      d.flags.push({ code: "SPLIT_ORDER", message: m });
      if (addStep(d.steps, ApprovalStepType.PROCUREMENT, "Policy: possible split purchase")) touched = true;
      touched = true;
    }
  }

  // 3. Budget.
  if (budget) {
    if (budget.blocking) {
      const v = budget.blocking.verdict;
      d.blocked = `This would take "${budget.blocking.name}" over budget by ${req.currency} ${money(v.overBy)} (only ${req.currency} ${money(v.remaining)} is left). Ask Finance to raise the budget, or reduce the request.`;
    } else if (budget.over.length > 0) {
      const b = budget.over[0];
      d.flags.push({ code: "BUDGET_OVER", message: `Over budget: "${b.name}" would be exceeded by ${req.currency} ${money(b.verdict.overBy)}.` });
      addStep(d.steps, ApprovalStepType.FINANCE, "Policy: over budget"); touched = true;
    } else if (budget.warn.length > 0) {
      const b = budget.warn[0];
      d.notes.push(`Budget "${b.name}" would be ${Math.round(b.verdict.pct)}% used (${req.currency} ${money(b.verdict.remaining - req.amount)} left after this).`);
    }
  }

  // 4. Auto-approve: only for a clean request — nothing flagged and no approval added by the rules above.
  if (!d.blocked && !touched) {
    for (const { p, type, rule } of parsed) if (type === "AUTO_APPROVE") {
      if (req.amount > (p.maxAmount as number) || !inList(p.categories as string[], req.category) || req.supplierIds.length === 0) continue;
      const trusted = req.supplierIds.every(id => { const s = facts.suppliers[id]; return s?.status === "ACTIVE" && (!p.requirePreferredSupplier || s.preferred); });
      if (!trusted) continue;
      d.steps = []; d.autoApproved = true;
      d.notes.push(`Approved automatically by policy "${rule.name}": ${req.currency} ${money(req.amount)} is within the ${money(p.maxAmount as number)} limit and the supplier is ${p.requirePreferredSupplier ? "a preferred supplier" : "active"}.`);
      break;
    }
  }

  // 5. Competitive quotes instead of an immediate PO.
  if (!d.blocked) for (const { rule, type, p } of parsed) if (type === "REQUIRE_SOURCING") {
    if (req.amount < (p.minAmount as number) || !inList(p.categories as string[], req.category)) continue;
    const covered = p.exemptIfContracted && req.supplierIds.length > 0 && req.supplierIds.every(id => facts.contractedSupplierIds.includes(id));
    if (covered) { d.notes.push(`Above the quote threshold, but the supplier is under an active contract (${rule.name}), so it goes straight to an order.`); continue; }
    d.requireSourcing = true;
    d.notes.push(`Goes to competitive quotes after approval: ${req.currency} ${money(req.amount)} is above ${money(p.minAmount as number)} with no covering contract (${rule.name}).`);
    break;
  }
  return d;
}
