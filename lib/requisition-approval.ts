import { Prisma, RequisitionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { canActOnStep, STATUS_FOR_STEP } from "@/lib/approval-matrix";
import { generatePONumber } from "@/lib/po-number";
import { sendPurchaseOrder } from "@/lib/po-send";
import { tellRequester } from "@/lib/requester-notify";
import { startSourcing } from "@/lib/orchestrator";
import { activeDelegators } from "@/lib/approval-delegation";
import { notifyCurrentApprovers } from "@/lib/approval-notify";

export type Result = { status: number; json: unknown };
export type Actor = { id: string; name: string; role: string };

/**
 * Applies one approver's decision to a requisition. The single place approval rules live, used by
 * the app, by the one-click email link and (later) by agents — so they can never disagree.
 */
export async function decideStep(opts: {
  organizationId: string; requisitionId: string; actor: Actor;
  decision: "APPROVE" | "REJECT"; comment?: string; via?: "app" | "email";
  origin?: string;
}): Promise<Result> {
  const { organizationId, requisitionId: id, actor, decision } = opts;
  const requisition = await prisma.requisition.findUnique({
    where: { id },
    include: { approvalSteps: { orderBy: { sequence: "asc" } }, requestor: { select: { id: true, name: true, email: true } } },
  });
  if (!requisition || requisition.organizationId !== organizationId) return { status: 404, json: { error: "Not found" } };

  // Steps sharing a sequence number are a parallel group; "current" is the lowest sequence with anything pending.
  const pending = requisition.approvalSteps.filter(s => s.status === "PENDING");
  if (pending.length === 0) return { status: 400, json: { error: "No pending approval step on this requisition" } };
  const currentSequence = Math.min(...pending.map(s => s.sequence));
  const currentGroup = pending.filter(s => s.sequence === currentSequence);

  // Someone may act on their own step — or on one belonging to a colleague who is out of office and named them.
  const delegators = await activeDelegators(actor.id);
  const myStep = currentGroup.find(s => canActOnStep(s, actor)) ?? currentGroup.find(s => s.approverId && delegators.includes(s.approverId));
  if (!myStep) return { status: 403, json: { error: "You're not authorized to act on this approval step" } };
  const onBehalfOf = myStep.approverId && myStep.approverId !== actor.id && delegators.includes(myStep.approverId) && !canActOnStep(myStep, actor) ? myStep.approverId : null;
  const note = [opts.comment?.trim(), onBehalfOf ? "(decided as delegate while the approver was out of office)" : "", opts.via === "email" ? "(via email link)" : ""].filter(Boolean).join(" ");

  // Claim the decision first. If two people (or an email click and an app click) decide at the same
  // instant, exactly one wins and the other is told, rather than both being applied.
  const claimed = await prisma.approvalStep.updateMany({
    where: { id: myStep.id, status: "PENDING" },
    data: { status: decision === "REJECT" ? "REJECTED" : "APPROVED", comment: note || null, decidedAt: new Date(), approverId: actor.id },
  });
  if (claimed.count === 0) return { status: 409, json: { error: "This approval was just decided by someone else." } };

  const audit = (action: "APPROVED" | "REJECTED", details: Record<string, unknown>) =>
    logAudit({ organizationId, userId: actor.id, userName: actor.name, action, entity: "REQUISITION", entityId: id, entityLabel: requisition.requisitionNumber, details: { ...details, via: opts.via ?? "app", ...(onBehalfOf && { onBehalfOf }) } });

  if (decision === "REJECT") {
    // A single veto kills the requisition regardless of ANY/ALL mode.
    await prisma.$transaction([
      prisma.approvalStep.updateMany({ where: { requisitionId: id, status: "PENDING" }, data: { status: "SKIPPED" } }),
      prisma.requisition.update({ where: { id }, data: { status: "REJECTED" } }),
    ]);
    await audit("REJECTED", { comment: opts.comment });
    await tellRequester(requisition, "rejected", { by: actor.name, comment: opts.comment });
    return { status: 200, json: { status: "REJECTED" } };
  }

  const others = currentGroup.filter(s => s.id !== myStep.id);
  if (myStep.approverMode === "ALL" && others.length > 0) {
    // ALL mode: wait for the rest of the group before the requisition moves on.
    await audit("APPROVED", { comment: opts.comment, step: myStep.stepType, waitingOn: others.length });
    return { status: 200, json: { status: requisition.status, waitingOn: others.length } };
  }

  const nextGroup = requisition.approvalSteps.filter(s => s.sequence === currentSequence + 1);
  const fullyApproved = nextGroup.length === 0;
  const newStatus = fullyApproved ? RequisitionStatus.APPROVED : STATUS_FOR_STEP[nextGroup[0].stepType];
  await prisma.$transaction([
    ...(others.length > 0 ? [prisma.approvalStep.updateMany({ where: { id: { in: others.map(s => s.id) } }, data: { status: "SKIPPED" } })] : []),
    prisma.requisition.update({ where: { id }, data: { status: newStatus } }),
  ]);
  await audit("APPROVED", { comment: opts.comment, step: myStep.stepType, fullyApproved });

  if (!fullyApproved) {
    // Push the next approver(s) their request straight away.
    await notifyCurrentApprovers({ requisitionId: id, origin: opts.origin }).catch(e => console.error("[approval] notify failed:", e));
    return { status: 200, json: { status: newStatus } };
  }

  const routed = await routeApproved({ requisitionId: requisition.id, organizationId, actor }).catch(e => { console.error("[approve] routing failed:", e); return null; });
  return { status: 200, json: { status: newStatus, purchaseOrderId: routed?.purchaseOrder?.id ?? null, sourcingEventId: routed?.sourcingEventId ?? null } };
}

/**
 * When fully approved, raise the PO and transmit it to the supplier right away — no "review the
 * draft, then send" step. If it can't be sent (no supplier email, supplier not yet onboarded) it is
 * left as a DRAFT for procurement to finish.
 */
export async function createPurchaseOrder(requisitionId: string, organizationId: string, actor: Actor) {
  const fullReq = await prisma.requisition.findUnique({
    where: { id: requisitionId },
    include: { lineItems: { include: { supplier: { select: { contactEmail: true, paymentTerms: true, poTransmissionMethod: true, cxmlEndpoint: true } } } } },
  });
  if (!fullReq) return null;
  const primary = fullReq.lineItems[0];
  const supplierId = primary?.supplierId ?? undefined;
  const po = await prisma.purchaseOrder.create({
    data: {
      organizationId, poNumber: await generatePONumber(organizationId), requisitionId, supplierId, createdById: actor.id,
      currency: fullReq.currency, subtotal: fullReq.totalAmount, taxAmount: fullReq.taxAmount ?? 0, totalAmount: fullReq.totalAmount,
      deliveryAddress: fullReq.deliveryLocation, expectedDelivery: fullReq.requiredDate ?? undefined,
      chartOfAccountId: fullReq.chartOfAccountId ?? undefined, glCoding: (fullReq.glCoding as Prisma.InputJsonValue) ?? undefined,
      routingMethod: primary?.supplier?.poTransmissionMethod ?? "EMAIL", cxmlEndpoint: primary?.supplier?.cxmlEndpoint ?? undefined,
      supplierEmail: primary?.supplier?.contactEmail ?? undefined, paymentTerms: primary?.supplier?.paymentTerms ?? undefined,
      notes: fullReq.description ?? fullReq.businessJustification ?? undefined,
      lineItems: {
        create: fullReq.lineItems.map(li => ({
          description: li.description, itemType: li.itemType, pricingType: li.pricingType, unit: li.unit, quantity: li.quantity, unitPrice: li.unitPrice, lineTotal: li.lineTotal,
          // { "1": "BA01", "2": "CC001", "3": "4500" } → "BA01 - CC001 - 4500"
          glAccount: (li.glCoding ? Object.values(li.glCoding as Record<string, string>).join(" - ") : null) ?? li.glAccount ?? undefined,
          supplierId: li.supplierId ?? undefined,
        })),
      },
    },
  });
  await logAudit({ organizationId, userId: actor.id, userName: actor.name, action: "CREATED", entity: "PURCHASE_ORDER", entityId: po.id, entityLabel: po.poNumber, details: { fromRequisition: fullReq.requisitionNumber } });
  if (supplierId) {
    const sent = await sendPurchaseOrder({ poId: po.id, organizationId, actorName: "Veltriance (auto-sent on approval)" });
    if ("error" in sent) console.error("[approve] PO auto-send failed, left as DRAFT:", sent.error);
  }
  return po;
}

/**
 * A request is fully approved (by people, or by policy). What happens next is decided by policy, not by
 * someone remembering to do it: above the quote threshold it goes out to competitive quotes; otherwise the
 * PO is raised and sent. Safe to call twice — an existing PO or sourcing event is returned, not duplicated.
 */
export async function routeApproved(opts: { requisitionId: string; organizationId: string; actor: Actor }) {
  const req = await prisma.requisition.findUnique({ where: { id: opts.requisitionId }, include: { requestor: { select: { name: true, email: true } }, purchaseOrder: { select: { id: true, poNumber: true } } } });
  if (!req || req.organizationId !== opts.organizationId) return null;
  if (req.purchaseOrder) return { purchaseOrder: req.purchaseOrder, sourcingEventId: req.sourcingEventId };
  if (req.requireSourcing) {
    if (req.sourcingEventId) return { purchaseOrder: null, sourcingEventId: req.sourcingEventId };
    const ev = await startSourcing({ requisitionId: req.id, organizationId: opts.organizationId });
    await tellRequester(req, "sourcing");
    return { purchaseOrder: null, sourcingEventId: ev?.id ?? null };
  }
  const po = await createPurchaseOrder(req.id, opts.organizationId, opts.actor);
  await tellRequester(req, "approved", { poNumber: po?.poNumber });
  return { purchaseOrder: po, sourcingEventId: null };
}
