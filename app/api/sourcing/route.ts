import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sourcingAccess } from "@/lib/sourcing-access";
import { EVENT_TYPES, closeOverdueEvents, nextEventNumber } from "@/lib/sourcing";

export async function GET(req: NextRequest) {
  const a = await sourcingAccess();
  if ("error" in a) return a.error;
  await closeOverdueEvents(a.org.id); // a passed deadline closes bidding now, not at tomorrow's cron
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const status = req.nextUrl.searchParams.get("status");
  const events = await prisma.sourcingEvent.findMany({
    where: {
      organizationId: a.org.id, ...(status && { status: status as never }),
      ...(q && { OR: [{ title: { contains: q, mode: "insensitive" } }, { eventNumber: { contains: q, mode: "insensitive" } }, { category: { contains: q, mode: "insensitive" } }] }),
    },
    orderBy: { updatedAt: "desc" }, take: 200,
    select: { id: true, eventNumber: true, title: true, type: true, status: true, category: true, currency: true, deadline: true, updatedAt: true, owner: { select: { name: true } }, _count: { select: { items: true, invites: true } } },
  });
  // Bids per event: an invite with a bid is one response.
  const invites = await prisma.sourcingInvite.findMany({ where: { eventId: { in: events.map(e => e.id) }, bid: { isNot: null } }, select: { eventId: true } });
  const perEvent = new Map<string, number>(); for (const i of invites) perEvent.set(i.eventId, (perEvent.get(i.eventId) ?? 0) + 1);
  return NextResponse.json({ events: events.map(e => ({ ...e, bids: perEvent.get(e.id) ?? 0 })) });
}

const createSchema = z.object({
  title: z.string().trim().min(3).max(200),
  type: z.enum(EVENT_TYPES).default("RFQ"),
  description: z.string().trim().max(5000).nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  deadline: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
  requiredDate: z.string().date().nullable().optional(),
  deliveryLocation: z.string().trim().max(300).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const a = await sourcingAccess();
  if ("error" in a) return a.error;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 });
  const d = parsed.data;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const event = await prisma.sourcingEvent.create({
        data: {
          organizationId: a.org.id, eventNumber: await nextEventNumber(a.org.id), title: d.title, type: d.type,
          description: d.description ?? null, category: d.category ?? null, currency: d.currency ?? "INR",
          deadline: d.deadline ? new Date(d.deadline) : null, requiredDate: d.requiredDate ? new Date(d.requiredDate) : null,
          deliveryLocation: d.deliveryLocation ?? null, ownerId: a.profile.id,
        },
      });
      await logAudit({ organizationId: a.org.id, userId: a.profile.id, userName: a.profile.name, action: "CREATED", entity: "SOURCING", entityId: event.id, entityLabel: `${event.eventNumber} ${event.title}` });
      return NextResponse.json({ event }, { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 2) continue;
      throw e;
    }
  }
}
