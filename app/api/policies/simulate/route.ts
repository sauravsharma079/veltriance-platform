import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { orgAccess } from "@/lib/org-access";
import { planRequisition } from "@/lib/orchestrator";

const schema = z.object({ amount: z.number().positive().max(1e13), currency: z.string().length(3).default("INR"), category: z.string().max(80).nullable().optional(), department: z.string().max(80).nullable().optional(), costCenter: z.string().max(80).nullable().optional(), supplierId: z.string().nullable().optional() });

/** "What would happen if…" — runs the real planner without creating anything, so admins can test their rules. */
export async function POST(req: NextRequest) {
  const a = await orgAccess({ roles: ["ADMIN", "PROCUREMENT"], module: "INTAKE_TO_PO" });
  if ("error" in a) return a.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 422 });
  const d = parsed.data;
  const plan = await planRequisition({ organizationId: a.org.id, requestorId: a.profile.id, amount: d.amount, currency: d.currency.toUpperCase(), category: d.category ?? null, department: d.department ?? null, costCenter: d.costCenter ?? null, supplierIds: d.supplierId ? [d.supplierId] : [] });
  return NextResponse.json({
    autoApproved: plan.decision.autoApproved, requireSourcing: plan.decision.requireSourcing, blocked: plan.decision.blocked,
    approvals: plan.decision.steps.map(s => s.stepLabel ?? s.stepType.toLowerCase()), flags: plan.decision.flags.map(f => f.message), notes: plan.decision.notes,
    budgets: plan.budget.checks.map(c => ({ name: c.name, status: c.verdict.status, remaining: c.verdict.remaining, pct: Math.round(c.verdict.pct) })),
  });
}
