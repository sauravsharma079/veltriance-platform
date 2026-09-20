import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { TRANSITIONS, closeOverdueEvents } from "@/lib/sourcing";
import { sendBidInvite, type BidInvite } from "@/lib/sourcing-invites";
import { nextContractNumber } from "@/lib/contracts";
import { generatePONumber } from "@/lib/po-number";
import { registerNewVendor, vendorReadiness } from "@/lib/vendors";

// The business rules behind the sourcing lifecycle, kept out of the route files so they
// can be exercised directly (the routes just add auth, licence checks and HTTP).

export type Actor = { org: { id: string; name: string }; profile: { id: string; name: string } };
export type Result = { status: number; json: unknown };

export async function transitionEvent(opts: Actor & { id: string; action: "publish" | "close" | "award" | "cancel"; inviteId?: string; reason?: string; origin: string }): Promise<Result> {
  const { org, profile, id, action, inviteId, reason } = opts;

  const rule = TRANSITIONS[action];
  await closeOverdueEvents(org.id); // a passed deadline closes bidding now, not at tomorrow's cron

  const event = await prisma.sourcingEvent.findFirst({
    where: { id, organizationId: org.id },
    include: { items: { select: { id: true } }, invites: { include: { bid: { select: { totalAmount: true } }, supplier: { select: { name: true, status: true, onboardingStage: true } } } } },
  });
  if (!event) return { status: 404, json: { error: "Not found" } };
  if (!rule.from.includes(event.status)) return { status: 422, json: { error: `You can't ${action} an event that is ${event.status.toLowerCase()}` } };

  if (action === "publish") {
    if (event.items.length === 0) return { status: 422, json: { error: "Add at least one item suppliers should price" } };
    if (event.invites.length === 0) return { status: 422, json: { error: "Invite at least one supplier" } };
    if (!event.deadline || event.deadline.getTime() < Date.now() + 5 * 60_000) return { status: 422, json: { error: "Set a deadline that is at least a few minutes in the future" } };
  }

  let awardData: { awardedInviteId: string; awardedAt: Date; awardReason: string | null } | undefined;
  if (action === "award") {
    const chosen = event.invites.find(i => i.id === inviteId);
    if (!chosen?.bid) return { status: 422, json: { error: "Pick a supplier that submitted a bid" } };
    const lowest = Math.min(...event.invites.filter(i => i.bid).map(i => Number(i.bid!.totalAmount)));
    // Awarding above the lowest price is legitimate (quality, risk, lead time) but must be explained — it's what an auditor asks.
    if (Number(chosen.bid.totalAmount) > lowest && (reason ?? "").length < 10)
      return { status: 422, json: { error: "This isn't the lowest bid — record why you're choosing it (at least a sentence)" } };
    awardData = { awardedInviteId: chosen.id, awardedAt: new Date(), awardReason: reason ?? null };
  }

  // Only one request can win the move; a double-click or race gets a 409.
  const moved = await prisma.sourcingEvent.updateMany({ where: { id, status: { in: rule.from } }, data: { status: rule.to, ...awardData } });
  if (moved.count === 0) return { status: 409, json: { error: "The event changed while you were working — reload and try again" } };

  // Any vendor who isn't on your supplier list yet (older events, or invites made before this
  // rule existed) is registered now, so they enter onboarding rather than bypassing it.
  const stillUnregistered = action === "publish" ? event.invites.filter(i => !i.supplierId) : [];
  for (const i of stillUnregistered) {
    const v = await registerNewVendor({ organizationId: org.id, actor: profile, name: i.name, email: i.email, contactName: i.contactName, category: event.category, source: `Sourcing ${event.eventNumber}` });
    await prisma.sourcingInvite.update({ where: { id: i.id }, data: { supplierId: v.supplier.id } });
  }

  let invites: BidInvite[] = [];
  if (action === "publish") {
    const origin = opts.origin;
    invites = await Promise.all(event.invites.map(i => sendBidInvite({ invite: i, event, orgName: org.name, origin })));
  }

  await logAudit({
    organizationId: org.id, userId: profile.id, userName: profile.name,
    action: action === "award" ? "APPROVED" : action === "cancel" ? "CANCELLED" : action === "publish" ? "SENT" : "UPDATED",
    entity: "SOURCING", entityId: id, entityLabel: `${event.eventNumber} ${event.title}`, details: { transition: action, to: rule.to, inviteId, reason },
  });
  // Awarding a vendor who hasn't finished onboarding is allowed (they may finish while you negotiate),
  // but the buyer is told plainly that nothing can be signed or ordered until they have.
  const warnings: string[] = [];
  if (action === "award" && awardData) {
    const winner = event.invites.find(i => i.id === awardData!.awardedInviteId);
    let supplier: { name: string; status: string; onboardingStage: string | null } | null = winner?.supplier ?? null;
    if (winner && !winner.supplierId) {
      const v = await registerNewVendor({ organizationId: org.id, actor: profile, name: winner.name, email: winner.email, contactName: winner.contactName, category: event.category, source: `Sourcing ${event.eventNumber} (awarded)` });
      await prisma.sourcingInvite.update({ where: { id: winner.id }, data: { supplierId: v.supplier.id } });
      supplier = v.supplier;
    }
    const ready = vendorReadiness(supplier);
    if (ready.ready === false) warnings.push(ready.reason);
  }
  return { status: 200, json: { status: rule.to, invites, warnings } };
}

export async function createContractFromAward(opts: Actor & { id: string }): Promise<Result> {
  const { org, profile, id } = opts;
  const a = { org, profile };

  const event = await prisma.sourcingEvent.findFirst({
    where: { id, organizationId: a.org.id },
    include: { items: { orderBy: { sequence: "asc" } }, invites: { where: { status: "SUBMITTED" }, include: { bid: { include: { lines: true } } } } },
  });
  if (!event) return { status: 404, json: { error: "Not found" } };
  if (event.status !== "AWARDED" || !event.awardedInviteId) return { status: 422, json: { error: "Award the event first" } };
  if (event.awardedContractId) return { status: 409, json: { error: "A contract was already created from this award", contractId: event.awardedContractId } };
  const winner = event.invites.find(i => i.id === event.awardedInviteId);
  if (!winner?.bid) return { status: 422, json: { error: "The winning bid is missing" } };
  // A contract always needs a supplier on file. Register a new vendor now if they aren't yet.
  let contractSupplierId = winner.supplierId;
  if (!contractSupplierId) {
    const v = await registerNewVendor({ organizationId: a.org.id, actor: a.profile, name: winner.name, email: winner.email, contactName: winner.contactName, category: event.category, source: `Sourcing ${event.eventNumber} (awarded)` });
    contractSupplierId = v.supplier.id;
    await prisma.sourcingInvite.update({ where: { id: winner.id }, data: { supplierId: contractSupplierId } });
  }

  const schedule = event.items.map(it => {
    const line = winner.bid!.lines.find(l => l.itemId === it.id);
    const price = line ? Number(line.unitPrice) : 0;
    return `${it.sequence}. ${it.description} — ${Number(it.quantity)}${it.unit ? ` ${it.unit}` : ""} × ${event.currency} ${price} = ${event.currency} ${(price * Number(it.quantity)).toFixed(2)}`;
  }).join("\n");
  const body = `AWARD SCHEDULE (from ${event.eventNumber}: ${event.title})\nSupplier: ${winner.name}\n\n${schedule}\n\nTotal: ${event.currency} ${Number(winner.bid.totalAmount).toFixed(2)}${winner.bid.paymentTerms ? `\nPayment terms offered: ${winner.bid.paymentTerms}` : ""}${winner.bid.leadTimeDays ? `\nLead time offered: ${winner.bid.leadTimeDays} days` : ""}\n\n[Use "Draft with AI" to build the full agreement around this schedule.]`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const contract = await prisma.$transaction(async tx => {
        const c = await tx.contract.create({
          data: {
            organizationId: a.org.id, contractNumber: await nextContractNumber(a.org.id),
            title: `${event.title} — ${winner.name}`, type: "PURCHASE_AGREEMENT", supplierId: contractSupplierId, ownerId: a.profile.id,
            description: `Awarded from ${event.eventNumber}.${event.awardReason ? ` Award rationale: ${event.awardReason}` : ""}`,
            value: winner.bid!.totalAmount, currency: event.currency,
            versions: { create: { versionNumber: 1, body, source: "HUMAN", createdById: a.profile.id, createdByName: a.profile.name, changeNote: `Created from ${event.eventNumber} award` } },
          },
        });
        // Claim it on the event in the same transaction, so two clicks can't make two contracts.
        const claimed = await tx.sourcingEvent.updateMany({ where: { id, awardedContractId: null }, data: { awardedContractId: c.id } });
        if (claimed.count === 0) throw new Error("ALREADY_CREATED");
        return c;
      });
      await logAudit({ organizationId: a.org.id, userId: a.profile.id, userName: a.profile.name, action: "CREATED", entity: "CONTRACT", entityId: contract.id, entityLabel: `${contract.contractNumber} ${contract.title}`, details: { fromSourcing: event.eventNumber } });
      return { status: 201, json: { contract } };
    } catch (e) {
      if (e instanceof Error && e.message === "ALREADY_CREATED") return { status: 409, json: { error: "A contract was already created from this award" } };
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 2) continue;
      throw e;
    }
  }
}

export async function createPoFromAward(opts: Actor & { id: string }): Promise<Result> {
  const { org, profile, id } = opts;
  const a = { org, profile };

  const event = await prisma.sourcingEvent.findFirst({
    where: { id, organizationId: org.id },
    include: { items: { orderBy: { sequence: "asc" } }, invites: { where: { status: "SUBMITTED" }, include: { bid: { include: { lines: true } }, supplier: true } } },
  });
  if (!event) return { status: 404, json: { error: "Not found" } };
  if (event.status !== "AWARDED" || !event.awardedInviteId) return { status: 422, json: { error: "Award the event first" } };
  if (event.awardedPoId) return { status: 409, json: { error: "A purchase order was already created from this award", poId: event.awardedPoId } };
  const winner = event.invites.find(i => i.id === event.awardedInviteId);
  if (!winner?.bid) return { status: 422, json: { error: "The winning bid is missing" } };
  // No PO to a vendor who hasn't been through onboarding. A vendor not yet on file is registered now,
  // so they appear in the onboarding queue, and the PO waits until they're Active.
  let poSupplier = winner.supplier;
  if (!winner.supplierId || !poSupplier) {
    const v = await registerNewVendor({ organizationId: org.id, actor: profile, name: winner.name, email: winner.email, contactName: winner.contactName, category: event.category, source: `Sourcing ${event.eventNumber} (awarded)` });
    await prisma.sourcingInvite.update({ where: { id: winner.id }, data: { supplierId: v.supplier.id } });
    const fresh = vendorReadiness(v.supplier);
    return { status: 422, json: { error: fresh.ready === false ? fresh.reason : "Supplier onboarding is required first." } };
  }
  const readiness = vendorReadiness(poSupplier);
  if (readiness.ready === false) return { status: 422, json: { error: readiness.reason } };

  const bid = winner.bid;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const po = await prisma.$transaction(async tx => {
        const created = await tx.purchaseOrder.create({
          data: {
            organizationId: org.id, poNumber: await generatePONumber(org.id), supplierId: winner.supplierId, createdById: profile.id,
            currency: event.currency, subtotal: bid.totalAmount, taxAmount: 0, totalAmount: bid.totalAmount,
            deliveryAddress: event.deliveryLocation, expectedDelivery: event.requiredDate ?? undefined,
            routingMethod: winner.supplier!.poTransmissionMethod ?? "EMAIL", cxmlEndpoint: winner.supplier!.cxmlEndpoint ?? undefined,
            supplierEmail: winner.email, paymentTerms: bid.paymentTerms ?? winner.supplier!.paymentTerms ?? undefined,
            notes: `Awarded from ${event.eventNumber}: ${event.title}.${event.awardReason ? ` Rationale: ${event.awardReason}` : ""}`,
            lineItems: {
              create: event.items.map(it => {
                const line = bid.lines.find(l => l.itemId === it.id);
                const unitPrice = line ? Number(line.unitPrice) : 0;
                return { description: it.description, unit: it.unit, quantity: it.quantity, unitPrice, lineTotal: unitPrice * Number(it.quantity), supplierId: winner.supplierId };
              }),
            },
          },
        });
        const claimed = await tx.sourcingEvent.updateMany({ where: { id, awardedPoId: null }, data: { awardedPoId: created.id } });
        if (claimed.count === 0) throw new Error("ALREADY_CREATED");
        return created;
      });
      await logAudit({ organizationId: org.id, userId: profile.id, userName: profile.name, action: "CREATED", entity: "PURCHASE_ORDER", entityId: po.id, entityLabel: po.poNumber, details: { fromSourcing: event.eventNumber } });
      return { status: 201, json: { purchaseOrder: po } };
    } catch (e) {
      if (e instanceof Error && e.message === "ALREADY_CREATED") return { status: 409, json: { error: "A purchase order was already created from this award" } };
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 2) continue;
      throw e;
    }
  }
}
