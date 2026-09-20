import type { Budget } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Budgets are checked against what is already COMMITTED, computed live from requisitions and purchase
// orders — nothing to reconcile by hand. A request is counted once: as a requisition while it's being
// approved, and as its PO after that (the PO replaces it; it doesn't add to it).
// Different currencies are not converted: only spend in the budget's own currency counts, and that is
// stated rather than guessed at.

export type BudgetStatus = "OK" | "WARN" | "OVER";
export type BudgetVerdict = { status: BudgetStatus; committed: number; requested: number; after: number; amount: number; remaining: number; overBy: number; pct: number };

/** Pure: given a budget's size, what's committed and the new request, is it fine, close, or over? */
export function evaluateBudget(b: { amount: number; warnPct: number }, committed: number, requested: number): BudgetVerdict {
  const cents = (n: number) => Math.round(n * 100);
  const after = (cents(committed) + cents(requested)) / 100;
  const over = cents(after) > cents(b.amount);
  const pct = b.amount > 0 ? (after / b.amount) * 100 : 100;
  return {
    status: over ? "OVER" : pct >= b.warnPct ? "WARN" : "OK",
    committed, requested, after, amount: b.amount,
    remaining: Math.max(0, (cents(b.amount) - cents(committed)) / 100),
    overBy: over ? (cents(after) - cents(b.amount)) / 100 : 0, pct,
  };
}

const COUNTED_REQ = ["SUBMITTED", "MANAGER_APPROVAL", "DIRECTOR_APPROVAL", "PROCUREMENT_REVIEW", "FINANCE_APPROVAL", "APPROVED"] as const;
const ci = (v: string | null) => (v ? { equals: v, mode: "insensitive" as const } : undefined);

/** How much of this budget is already spoken for. */
export async function committedFor(b: Pick<Budget, "organizationId" | "startDate" | "endDate" | "currency" | "department" | "costCenter" | "category">, excludeRequisitionId?: string): Promise<number> {
  const dims = { department: ci(b.department), costCenter: ci(b.costCenter), category: ci(b.category) };
  const [reqs, pos] = await Promise.all([
    // A requisition that already has a PO is counted through the PO below.
    prisma.requisition.aggregate({
      where: { organizationId: b.organizationId, status: { in: [...COUNTED_REQ] }, currency: b.currency, ...dims, purchaseOrder: null, ...(excludeRequisitionId && { id: { not: excludeRequisitionId } }),
        OR: [{ submittedAt: { gte: b.startDate, lte: b.endDate } }, { submittedAt: null, createdAt: { gte: b.startDate, lte: b.endDate } }] },
      _sum: { totalAmount: true },
    }),
    prisma.purchaseOrder.aggregate({
      where: { organizationId: b.organizationId, status: { not: "CANCELLED" }, currency: b.currency, createdAt: { gte: b.startDate, lte: b.endDate },
        ...(b.department || b.costCenter || b.category ? { requisition: { is: { ...dims } } } : {}), ...(excludeRequisitionId && { NOT: { requisitionId: excludeRequisitionId } }) },
      _sum: { totalAmount: true },
    }),
  ]);
  return Number(reqs._sum.totalAmount ?? 0) + Number(pos._sum.totalAmount ?? 0);
}

export type BudgetCheck = { budgetId: string; name: string; hardStop: boolean; verdict: BudgetVerdict };
export type BudgetCheckResult = { checks: BudgetCheck[]; worst: BudgetStatus; blocking: BudgetCheck | null; over: BudgetCheck[]; warn: BudgetCheck[] };

/** Every active budget that covers this request, and how the request fares against each. */
export async function checkBudgets(r: {
  organizationId: string; amount: number; currency: string; department: string | null; costCenter: string | null; category: string | null; at?: Date; excludeRequisitionId?: string;
}): Promise<BudgetCheckResult> {
  const at = r.at ?? new Date();
  const budgets = await prisma.budget.findMany({ where: { organizationId: r.organizationId, active: true, currency: r.currency, startDate: { lte: at }, endDate: { gte: at } } });
  const same = (a: string | null, b: string | null) => !a || (!!b && a.toLowerCase() === b.toLowerCase()); // a blank budget dimension covers everything
  const checks: BudgetCheck[] = [];
  for (const b of budgets) {
    if (!same(b.department, r.department) || !same(b.costCenter, r.costCenter) || !same(b.category, r.category)) continue;
    const committed = await committedFor(b, r.excludeRequisitionId);
    checks.push({ budgetId: b.id, name: b.name, hardStop: b.hardStop, verdict: evaluateBudget({ amount: Number(b.amount), warnPct: b.warnPct }, committed, r.amount) });
  }
  const over = checks.filter(c => c.verdict.status === "OVER"), warn = checks.filter(c => c.verdict.status === "WARN");
  return { checks, worst: over.length ? "OVER" : warn.length ? "WARN" : "OK", blocking: over.find(c => c.hardStop) ?? null, over, warn };
}

/** Budgets with live usage, for the Budgets page. */
export async function budgetsWithUsage(organizationId: string) {
  const budgets = await prisma.budget.findMany({ where: { organizationId }, orderBy: [{ active: "desc" }, { endDate: "desc" }] });
  return Promise.all(budgets.map(async b => {
    const committed = await committedFor(b);
    return { ...b, amount: Number(b.amount), committed, remaining: Math.round((Number(b.amount) - committed) * 100) / 100, pct: Number(b.amount) > 0 ? (committed / Number(b.amount)) * 100 : 0 };
  }));
}
