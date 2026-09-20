import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sha256 } from "@/lib/contracts";

/**
 * Unauthenticated endpoint behind a supplier's personal bid link. The token is
 * 256 bits of randomness and only its hash is stored. It exposes ONE event and
 * ONLY this supplier's own bid — never other suppliers, and never the buyer's
 * internal target prices or evaluation.
 */
async function load(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  return prisma.sourcingInvite.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      bid: { include: { lines: true } },
      event: { include: { organization: { select: { name: true } }, items: { orderBy: { sequence: "asc" } } } },
    },
  });
}

const HIDDEN = ["DRAFT", "CANCELLED"]; // not (or no longer) shared with suppliers

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const inv = await load((await ctx.params).token);
  if (!inv || HIDDEN.includes(inv.event.status)) return NextResponse.json({ error: "This link isn't valid any more" }, { status: 404 });
  const e = inv.event;
  if (inv.status === "INVITED") await prisma.sourcingInvite.updateMany({ where: { id: inv.id, status: "INVITED" }, data: { status: "VIEWED", viewedAt: new Date() } });

  const open = e.status === "OPEN" && !!e.deadline && e.deadline.getTime() > Date.now();
  return NextResponse.json({
    organization: e.organization.name,
    event: {
      title: e.title, eventNumber: e.eventNumber, type: e.type, description: e.description, category: e.category, currency: e.currency,
      deadline: e.deadline, requiredDate: e.requiredDate, deliveryLocation: e.deliveryLocation, terms: e.terms, questions: e.questions ?? [], status: e.status,
      // targetPrice is deliberately omitted
      items: e.items.map(i => ({ id: i.id, sequence: i.sequence, description: i.description, quantity: Number(i.quantity), unit: i.unit, specification: i.specification })),
    },
    you: { name: inv.name, status: inv.status === "INVITED" ? "VIEWED" : inv.status },
    bid: inv.bid ? {
      revision: inv.bid.revision, submittedAt: inv.bid.submittedAt, totalAmount: Number(inv.bid.totalAmount), leadTimeDays: inv.bid.leadTimeDays,
      paymentTerms: inv.bid.paymentTerms, validityDays: inv.bid.validityDays, notes: inv.bid.notes, answers: inv.bid.answers ?? {},
      lines: inv.bid.lines.map(l => ({ itemId: l.itemId, unitPrice: Number(l.unitPrice), leadTimeDays: l.leadTimeDays, notes: l.notes })),
    } : null,
    canBid: open && inv.status !== "DECLINED",
    closedReason: open ? null : e.status === "OPEN" ? "The deadline has passed" : e.status === "AWARDED" ? "This event has been awarded" : "Bidding has closed",
  });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("submit_bid"),
    lines: z.array(z.object({ itemId: z.string().min(1), unitPrice: z.number().positive().max(1e9), leadTimeDays: z.number().int().min(0).max(1000).nullable().optional(), notes: z.string().trim().max(500).nullable().optional() })).min(1).max(200),
    leadTimeDays: z.number().int().min(0).max(1000).nullable().optional(),
    paymentTerms: z.string().trim().max(200).nullable().optional(),
    validityDays: z.number().int().min(1).max(730).nullable().optional(),
    notes: z.string().trim().max(3000).nullable().optional(),
    answers: z.record(z.string(), z.string().trim().max(3000)).optional(),
  }),
  z.object({ action: z.literal("decline"), reason: z.string().trim().max(1000).optional() }),
]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const inv = await load((await ctx.params).token);
  if (!inv || HIDDEN.includes(inv.event.status)) return NextResponse.json({ error: "This link isn't valid any more" }, { status: 404 });
  const e = inv.event;
  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 });
  const d = parsed.data;
  const audit = (details: Record<string, unknown>) => logAudit({ organizationId: e.organizationId, userName: `${inv.name} (supplier)`, action: "UPDATED", entity: "SOURCING", entityId: e.id, entityLabel: `${e.eventNumber} ${e.title}`, details });

  const open = e.status === "OPEN" && !!e.deadline && e.deadline.getTime() > Date.now();
  if (!open) return NextResponse.json({ error: e.status === "OPEN" ? "The deadline has passed" : "Bidding is closed" }, { status: 422 });
  if (inv.status === "DECLINED") return NextResponse.json({ error: "You declined to bid on this event" }, { status: 422 });

  if (d.action === "decline") {
    if (inv.bid) return NextResponse.json({ error: "You've already submitted a bid" }, { status: 422 });
    await prisma.sourcingInvite.update({ where: { id: inv.id }, data: { status: "DECLINED", declineReason: d.reason ?? null } });
    await audit({ declined: true, reason: d.reason });
    return NextResponse.json({ ok: true });
  }

  // ── submit_bid ── prices must cover every item, exactly once, and only this event's items.
  const itemIds = new Set(e.items.map(i => i.id));
  const seen = new Set<string>();
  for (const l of d.lines) {
    if (!itemIds.has(l.itemId)) return NextResponse.json({ error: "One of the lines isn't part of this request" }, { status: 422 });
    if (seen.has(l.itemId)) return NextResponse.json({ error: "An item was priced twice" }, { status: 422 });
    seen.add(l.itemId);
  }
  if (seen.size !== itemIds.size) return NextResponse.json({ error: "Please price every item" }, { status: 422 });
  const questions = (Array.isArray(e.questions) ? e.questions : []) as { id: string; text: string; required: boolean }[];
  const missing = questions.find(q => q.required && !(d.answers?.[q.id] ?? "").trim());
  if (missing) return NextResponse.json({ error: `Please answer: ${missing.text}` }, { status: 422 });

  // The total is always computed here — a supplier's arithmetic is never trusted.
  const qty = new Map(e.items.map(i => [i.id, Number(i.quantity)]));
  const total = d.lines.reduce((s, l) => s + l.unitPrice * (qty.get(l.itemId) ?? 0), 0);
  const answers = Object.fromEntries(Object.entries(d.answers ?? {}).filter(([k]) => questions.some(q => q.id === k)));

  try {
    const bid = await prisma.$transaction(async tx => {
      // Re-check inside the transaction: the deadline may have passed while we were validating.
      const fresh = await tx.sourcingEvent.findUnique({ where: { id: e.id }, select: { status: true, deadline: true } });
      if (fresh?.status !== "OPEN" || !fresh.deadline || fresh.deadline.getTime() <= Date.now()) throw new Error("CLOSED");
      const data = {
        totalAmount: total, currency: e.currency, leadTimeDays: d.leadTimeDays ?? null, paymentTerms: d.paymentTerms ?? null,
        validityDays: d.validityDays ?? null, notes: d.notes ?? null, answers: answers as Prisma.InputJsonValue, submittedAt: new Date(),
      };
      const existing = await tx.sourcingBid.findUnique({ where: { inviteId: inv.id } });
      const saved = existing
        ? await tx.sourcingBid.update({ where: { id: existing.id }, data: { ...data, revision: { increment: 1 } } })
        : await tx.sourcingBid.create({ data: { ...data, inviteId: inv.id } });
      await tx.sourcingBidLine.deleteMany({ where: { bidId: saved.id } });
      await tx.sourcingBidLine.createMany({ data: d.lines.map(l => ({ bidId: saved.id, itemId: l.itemId, unitPrice: l.unitPrice, leadTimeDays: l.leadTimeDays ?? null, notes: l.notes ?? null })) });
      await tx.sourcingInvite.update({ where: { id: inv.id }, data: { status: "SUBMITTED" } });
      return saved;
    });
    await audit({ bid: bid.revision > 1 ? "revised" : "submitted", revision: bid.revision, total });
    return NextResponse.json({ ok: true, revision: bid.revision, totalAmount: total });
  } catch (err) {
    if (err instanceof Error && err.message === "CLOSED") return NextResponse.json({ error: "The deadline has just passed" }, { status: 422 });
    throw err;
  }
}
