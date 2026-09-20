import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { resolveApprovalSteps } from "@/lib/approval-matrix";
import { checkBudgets, type BudgetCheckResult } from "@/lib/budget";
import { evaluatePolicies, type PolicyDecision, type PolicyFacts } from "@/lib/policy";
import { newSigningToken, publicBaseUrl } from "@/lib/contracts";
import { nextEventNumber } from "@/lib/sourcing";
import { transitionEvent } from "@/lib/sourcing-actions";
import { signLink } from "@/lib/signed-links";

// The orchestrator is what turns separate modules into one autonomous chain. Rules decide the route;
// the agents and the people are used where judgement is genuinely needed.

const ACTIVE_REQ = ["SUBMITTED", "MANAGER_APPROVAL", "DIRECTOR_APPROVAL", "PROCUREMENT_REVIEW", "FINANCE_APPROVAL", "APPROVED", "PO_CREATED"] as const;
const signedIn = { AND: [{ authId: { not: null } }, { NOT: { authId: { startsWith: "pending_" } } }] };
const daysAgo = (d: Date) => Math.floor((Date.now() - d.getTime()) / 86_400_000);

export type RequestPlan = { decision: PolicyDecision; budget: BudgetCheckResult; policyException: boolean; policyExceptionNote: string | null };

/**
 * How should this request travel? Combines the org's approval rules, its budgets and its policy rules
 * into one answer. Called when a request is submitted — from chat intake or from a saved draft.
 */
export async function planRequisition(r: {
  organizationId: string; requestorId: string; amount: number; currency: string;
  category: string | null; department: string | null; costCenter: string | null; supplierIds: string[]; requisitionId?: string;
}): Promise<RequestPlan> {
  const [baseSteps, rules, budget, suppliers, contracts, recent] = await Promise.all([
    resolveApprovalSteps(r.organizationId, r.amount, r.category, r.department),
    prisma.policyRule.findMany({ where: { organizationId: r.organizationId, active: true }, orderBy: { createdAt: "asc" } }),
    checkBudgets({ organizationId: r.organizationId, amount: r.amount, currency: r.currency, department: r.department, costCenter: r.costCenter, category: r.category, excludeRequisitionId: r.requisitionId }),
    prisma.supplier.findMany({ where: { organizationId: r.organizationId, id: { in: r.supplierIds } }, select: { id: true, status: true, preferred: true } }),
    prisma.contract.findMany({ where: { organizationId: r.organizationId, status: "ACTIVE", supplierId: { in: r.supplierIds }, OR: [{ endDate: null }, { endDate: { gt: new Date() } }] }, select: { supplierId: true } }),
    prisma.requisition.findMany({
      where: { organizationId: r.organizationId, requestorId: r.requestorId, status: { in: [...ACTIVE_REQ] }, ...(r.requisitionId && { id: { not: r.requisitionId } }), createdAt: { gte: new Date(Date.now() - 90 * 86_400_000) } },
      select: { totalAmount: true, category: true, createdAt: true, lineItems: { select: { supplierId: true } } },
    }),
  ]);
  const facts: PolicyFacts = {
    suppliers: Object.fromEntries(suppliers.map(s => [s.id, { status: s.status, preferred: s.preferred }])),
    contractedSupplierIds: contracts.map(c => c.supplierId!).filter(Boolean),
    recent: recent.map(x => ({ amount: Number(x.totalAmount), category: x.category, supplierIds: x.lineItems.map(l => l.supplierId).filter((y): y is string => !!y), ageDays: daysAgo(x.createdAt) })),
  };
  const decision = evaluatePolicies(rules, { amount: r.amount, currency: r.currency, category: r.category, department: r.department, requestorId: r.requestorId, supplierIds: r.supplierIds }, facts, baseSteps, budget);
  const flagged = decision.flags.length > 0;
  return { decision, budget, policyException: flagged, policyExceptionNote: flagged ? decision.flags.map(f => f.message).join(" ") : null };
}

// ─── Sourcing that starts by itself ──────────────────────────────────────────

/**
 * An approved request that policy sends to competitive quotes becomes a sourcing event, pre-filled from the
 * request (the price the requester expected becomes the internal target), with a shortlist of suppliers chosen
 * by fit, preference, rating and risk. In "Ask me first" mode it waits as a draft for Procurement to publish;
 * in the autonomous modes it publishes itself.
 */
export async function startSourcing(opts: { requisitionId: string; organizationId: string }) {
  const req = await prisma.requisition.findUnique({
    where: { id: opts.requisitionId },
    include: { lineItems: true, requestor: { select: { id: true, name: true, email: true } }, organization: { select: { name: true, agentAutonomy: true } } },
  });
  if (!req || req.organizationId !== opts.organizationId || req.sourcingEventId) return req?.sourcingEventId ? { id: req.sourcingEventId } : null;

  const staff = await prisma.user.findMany({ where: { organizationId: opts.organizationId, role: { in: ["PROCUREMENT", "ADMIN"] }, ...signedIn }, select: { id: true, name: true, email: true, role: true }, orderBy: { role: "asc" } });
  const owner = staff.find(u => u.role === "PROCUREMENT") ?? staff[0] ?? req.requestor;

  // Shortlist: suppliers already on the request first, then others in the same category; never a risky one.
  const named = req.lineItems.map(l => l.supplierId).filter((x): x is string => !!x);
  const pool = await prisma.supplier.findMany({
    where: { organizationId: opts.organizationId, status: "ACTIVE", contactEmail: { not: null }, AND: [
        // Not yet risk-rated is fine; a plain NOT(in) would silently drop those rows in SQL (NULL semantics).
        { OR: [{ riskLevel: null }, { riskLevel: { notIn: ["HIGH", "CRITICAL"] } }] },
        { OR: [{ id: { in: named } }, ...(req.category ? [{ category: { contains: req.category, mode: "insensitive" as const } }] : [])] },
      ] },
    orderBy: [{ preferred: "desc" }, { rating: "desc" }], take: 12,
  });
  const shortlist = [...pool.filter(s => named.includes(s.id)), ...pool.filter(s => !named.includes(s.id))].slice(0, 4);

  const event = await prisma.$transaction(async tx => {
    const e = await tx.sourcingEvent.create({
      data: {
        organizationId: opts.organizationId, eventNumber: await nextEventNumber(opts.organizationId), title: req.title, type: "RFQ",
        description: [req.description, req.businessJustification, `Raised automatically from ${req.requisitionNumber}.`].filter(Boolean).join("\n\n"),
        category: req.category, currency: req.currency, deadline: new Date(Date.now() + 7 * 86_400_000), requiredDate: req.requiredDate, deliveryLocation: req.deliveryLocation,
        requisitionId: req.id, ownerId: owner.id,
        items: { create: req.lineItems.map((l, i) => ({ sequence: i + 1, description: l.description, quantity: l.quantity, unit: l.unit, targetPrice: l.unitPrice })) },
        invites: { create: shortlist.map(s => ({ supplierId: s.id, name: s.name, contactName: s.contactName, email: s.contactEmail!, tokenHash: newSigningToken().tokenHash })) },
      },
    });
    await tx.requisition.update({ where: { id: req.id }, data: { sourcingEventId: e.id } });
    return e;
  });
  await logAudit({ organizationId: opts.organizationId, userName: "Orchestrator", action: "CREATED", entity: "SOURCING", entityId: event.id, entityLabel: `${event.eventNumber} ${event.title}`, details: { fromRequisition: req.requisitionNumber, invited: shortlist.length } });

  // Publish straight away only when the org has let agents act, and only if there's a real field to invite.
  let published = false;
  if (req.organization.agentAutonomy !== "SUGGEST" && shortlist.length >= 2) {
    const r = await transitionEvent({ org: { id: opts.organizationId, name: req.organization.name }, profile: { id: owner.id, name: owner.name }, id: event.id, action: "publish", origin: publicBaseUrl() });
    published = r.status === 200;
  }
  const link = `${publicBaseUrl()}/dashboard/sourcing/${event.id}`;
  const why = shortlist.length < 2 ? "There aren't enough suitable suppliers to invite yet — add some." : published ? "Invitations have been sent." : "Review it and publish when you're ready.";
  await Promise.all(staff.map(u => sendEmail({ to: u.email, subject: `Sourcing started: ${req.title}`, text: `Hello ${u.name},\n\n${req.requisitionNumber} (${req.title}, ${req.currency} ${Number(req.totalAmount).toLocaleString()}) was approved and, by policy, is going out for competitive quotes. A request for quotation was created automatically with ${shortlist.length} supplier(s) shortlisted. ${why}\n\n${link}\n\n${req.organization.name}` }).catch(() => {})));
  return { id: event.id, published, invited: shortlist.length };
}

// ─── Touchless receiving ─────────────────────────────────────────────────────

/**
 * On the delivery date, ask whoever ordered whether it arrived — with a one-click link that records the
 * receipt — instead of waiting for someone to remember to log it. Once per PO.
 */
export async function promptDeliveryConfirmations(now = new Date(), organizationId?: string, origin?: string) {
  const due = await prisma.purchaseOrder.findMany({
    where: { status: { in: ["SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED"] }, receiptPromptedAt: null, expectedDelivery: { lte: now }, ...(organizationId && { organizationId }) },
    include: { requisition: { select: { requestorId: true } }, supplier: { select: { name: true } }, organization: { select: { name: true } }, createdBy: { select: { id: true } } },
    take: 200,
  });
  let prompted = 0;
  for (const po of due) {
    const userId = po.requisition?.requestorId ?? po.createdBy.id;
    const u = await prisma.user.findFirst({ where: { id: userId, organizationId: po.organizationId, ...signedIn }, select: { id: true, name: true, email: true } });
    if (!u) continue;
    const link = `${publicBaseUrl(origin)}/receive/${signLink("receive", { p: po.id, u: u.id }, 14)}`;
    const r = await sendEmail({ to: u.email, subject: `Did it arrive? ${po.poNumber}${po.supplier ? ` from ${po.supplier.name}` : ""}`, text: `Hello ${u.name},\n\nPurchase order ${po.poNumber}${po.supplier ? ` from ${po.supplier.name}` : ""} was due to be delivered by now.\n\nIf everything has arrived, confirm it in one click — no login needed:\n${link}\n\nIf something is missing or wrong, use the same link to say so.\n\n${po.organization.name}` });
    // A prompt that couldn't be emailed is retried tomorrow rather than marked as done.
    if (r.sent === false) continue;
    await prisma.purchaseOrder.update({ where: { id: po.id }, data: { receiptPromptedAt: now } });
    prompted++;
  }
  return { due: due.length, prompted };
}
