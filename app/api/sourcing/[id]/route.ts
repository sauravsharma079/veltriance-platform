import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sourcingAccess } from "@/lib/sourcing-access";
import { EVENT_TYPES, closeOverdueEvents, scoreBids } from "@/lib/sourcing";
import { itemSchema } from "@/lib/sourcing-schema";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const a = await sourcingAccess();
  if ("error" in a) return a.error;
  await closeOverdueEvents(a.org.id); // a passed deadline closes bidding now, not at tomorrow's cron
  const { id } = await ctx.params;
  const event = await prisma.sourcingEvent.findFirst({
    where: { id, organizationId: a.org.id },
    include: {
      owner: { select: { id: true, name: true } },
      items: { orderBy: { sequence: "asc" } },
      invites: {
        // tokenHash is never selected: it's the credential behind a supplier's bid link.
        select: {
          id: true, name: true, contactName: true, email: true, status: true, invitedAt: true, viewedAt: true, declineReason: true, supplierId: true,
          supplier: { select: { id: true, name: true, riskLevel: true, riskScore: true, rating: true, status: true, onboardingStage: true } },
          bid: { include: { lines: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const submitted = event.invites.filter(i => i.bid);
  const scores = scoreBids(submitted.map(i => ({ inviteId: i.id, total: Number(i.bid!.totalAmount), leadTimeDays: i.bid!.leadTimeDays, riskLevel: i.supplier?.riskLevel ?? null })));
  return NextResponse.json({ event, scores });
}

const patchSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  type: z.enum(EVENT_TYPES).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  deadline: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
  requiredDate: z.string().date().nullable().optional(),
  deliveryLocation: z.string().trim().max(300).nullable().optional(),
  terms: z.string().trim().max(10_000).nullable().optional(),
  questions: z.array(z.object({ id: z.string().min(1).max(40), text: z.string().trim().min(3).max(500), required: z.boolean() })).max(30).optional(),
  items: z.array(itemSchema).max(200).optional(),
});

/**
 * DRAFT: everything is editable. OPEN: only the deadline, and only to extend it —
 * changing what suppliers priced against, mid-bid, would be unfair to those who already did.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const a = await sourcingAccess();
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const existing = await prisma.sourcingEvent.findFirst({ where: { id, organizationId: a.org.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 });
  const d = parsed.data;

  if (existing.status === "OPEN") {
    const others = Object.keys(d).filter(k => k !== "deadline");
    if (others.length > 0) return NextResponse.json({ error: "Once published, only the deadline can change — and only to extend it" }, { status: 422 });
    if (!d.deadline) return NextResponse.json({ error: "Nothing to change" }, { status: 422 });
    const next = new Date(d.deadline);
    if (existing.deadline && next <= existing.deadline) return NextResponse.json({ error: "The new deadline must be later than the current one" }, { status: 422 });
  } else if (existing.status !== "DRAFT") {
    return NextResponse.json({ error: `A ${existing.status.toLowerCase()} event can't be edited` }, { status: 422 });
  }

  const event = await prisma.$transaction(async tx => {
    if (d.items) {
      // Drafts have no bids, so replacing the item list can't orphan anything.
      await tx.sourcingItem.deleteMany({ where: { eventId: id } });
      await tx.sourcingItem.createMany({ data: d.items.map((it, i) => ({ eventId: id, sequence: i + 1, description: it.description, quantity: it.quantity, unit: it.unit ?? null, specification: it.specification ?? null, targetPrice: it.targetPrice ?? null })) });
    }
    return tx.sourcingEvent.update({
      where: { id },
      data: {
        ...(d.title !== undefined && { title: d.title }), ...(d.type !== undefined && { type: d.type }),
        ...(d.description !== undefined && { description: d.description }), ...(d.category !== undefined && { category: d.category }),
        ...(d.currency !== undefined && { currency: d.currency }), ...(d.deliveryLocation !== undefined && { deliveryLocation: d.deliveryLocation }),
        ...(d.terms !== undefined && { terms: d.terms }), ...(d.questions !== undefined && { questions: d.questions }),
        ...(d.deadline !== undefined && { deadline: d.deadline ? new Date(d.deadline) : null }),
        ...(d.requiredDate !== undefined && { requiredDate: d.requiredDate ? new Date(d.requiredDate) : null }),
      },
    });
  });
  await logAudit({ organizationId: a.org.id, userId: a.profile.id, userName: a.profile.name, action: "UPDATED", entity: "SOURCING", entityId: id, entityLabel: `${existing.eventNumber} ${existing.title}`, details: { fields: Object.keys(d) } });
  return NextResponse.json({ event });
}
