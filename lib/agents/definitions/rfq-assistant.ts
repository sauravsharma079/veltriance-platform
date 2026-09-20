import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { defineTool, type AgentDef } from "@/lib/agents/runtime";
import { newSigningToken } from "@/lib/contracts";

const getEvent = defineTool({
  name: "get_event",
  description: "Loads an RFx event: its brief, current items and questions, and who is already invited.",
  risk: "read",
  input: z.object({ eventId: z.string().min(1) }),
  async run(ctx, input) {
    const e = await prisma.sourcingEvent.findFirst({
      where: { id: input.eventId, organizationId: ctx.organizationId },
      include: { items: { orderBy: { sequence: "asc" } }, invites: { select: { name: true, supplierId: true } } },
    });
    if (!e) throw new Error("Event not found");
    return {
      eventId: e.id, number: e.eventNumber, title: e.title, type: e.type, status: e.status, category: e.category, currency: e.currency,
      description: e.description, deliveryLocation: e.deliveryLocation, requiredDate: e.requiredDate?.toISOString().slice(0, 10) ?? null,
      items: e.items.map(i => ({ description: i.description, quantity: Number(i.quantity), unit: i.unit })),
      questions: e.questions ?? [], alreadyInvited: e.invites.map(i => i.name),
    };
  },
});

const listCandidates = defineTool({
  name: "list_supplier_candidates",
  description: "Lists suppliers in the organisation that could be invited (active, with a contact email, not already invited). Optionally filter by a category keyword.",
  risk: "read",
  input: z.object({ eventId: z.string().min(1), category: z.string().max(80).optional() }),
  async run(ctx, input) {
    const e = await prisma.sourcingEvent.findFirst({ where: { id: input.eventId, organizationId: ctx.organizationId }, select: { id: true, invites: { select: { supplierId: true } } } });
    if (!e) throw new Error("Event not found");
    const invited = e.invites.map(i => i.supplierId).filter((x): x is string => !!x);
    const suppliers = await prisma.supplier.findMany({
      where: {
        organizationId: ctx.organizationId, status: "ACTIVE", contactEmail: { not: null }, id: { notIn: invited },
        ...(input.category && { OR: [{ category: { contains: input.category, mode: "insensitive" } }, { description: { contains: input.category, mode: "insensitive" } }] }),
      },
      orderBy: [{ preferred: "desc" }, { rating: "desc" }], take: 20,
      select: { id: true, name: true, category: true, rating: true, riskLevel: true, preferred: true, country: true },
    });
    return { count: suppliers.length, suppliers };
  },
});

const proposeItems = defineTool({
  name: "propose_items",
  description: "Sets the list of things suppliers must quote for, and optional questions they must answer. Replaces any existing items. Only works while the event is a draft. Never invent quantities: if the brief doesn't give one, use 1 and say in `specification` that the quantity is to be confirmed.",
  risk: "write",
  input: z.object({
    eventId: z.string().min(1),
    items: z.array(z.object({ description: z.string().min(2).max(300), quantity: z.number().positive().max(1e9), unit: z.string().max(20).optional(), specification: z.string().max(1500).optional() })).min(1).max(40),
    questions: z.array(z.object({ text: z.string().min(5).max(400), required: z.boolean() })).max(10).optional(),
  }),
  async run(ctx, input) {
    const e = await prisma.sourcingEvent.findFirst({ where: { id: input.eventId, organizationId: ctx.organizationId }, select: { status: true } });
    if (!e) throw new Error("Event not found");
    if (e.status !== "DRAFT") throw new Error("Items can only be changed while the event is a draft");
    await prisma.$transaction(async tx => {
      await tx.sourcingItem.deleteMany({ where: { eventId: input.eventId } });
      await tx.sourcingItem.createMany({ data: input.items.map((it, i) => ({ eventId: input.eventId, sequence: i + 1, description: it.description, quantity: it.quantity, unit: it.unit ?? null, specification: it.specification ?? null })) });
      if (input.questions) await tx.sourcingEvent.update({ where: { id: input.eventId }, data: { questions: input.questions.map((q, i) => ({ id: `q${i + 1}`, text: q.text, required: q.required })) } });
    });
    return { items: input.items.length, questions: input.questions?.length ?? 0 };
  },
});

const proposeInvites = defineTool({
  name: "propose_invites",
  description: "Adds suppliers to the invite list (they are emailed only when the buyer publishes the event). Use supplier IDs returned by list_supplier_candidates. Pick the 3-5 best fits.",
  risk: "write",
  input: z.object({ eventId: z.string().min(1), supplierIds: z.array(z.string().min(1)).min(1).max(8), rationale: z.string().min(10).max(600) }),
  async run(ctx, input) {
    const e = await prisma.sourcingEvent.findFirst({ where: { id: input.eventId, organizationId: ctx.organizationId }, select: { status: true } });
    if (!e) throw new Error("Event not found");
    if (!["DRAFT", "OPEN"].includes(e.status)) throw new Error("Suppliers can't be added at this stage");
    const suppliers = await prisma.supplier.findMany({ where: { id: { in: input.supplierIds }, organizationId: ctx.organizationId, status: "ACTIVE", contactEmail: { not: null } } });
    let added = 0;
    for (const s of suppliers) {
      const dupe = await prisma.sourcingInvite.findFirst({ where: { eventId: input.eventId, OR: [{ supplierId: s.id }, { email: s.contactEmail! }] } });
      if (dupe) continue;
      await prisma.sourcingInvite.create({ data: { eventId: input.eventId, supplierId: s.id, name: s.name, contactName: s.contactName, email: s.contactEmail!, tokenHash: newSigningToken().tokenHash } });
      added++;
    }
    // An approval that changes nothing must not look like it worked.
    if (added === 0) throw new Error("None of those suppliers could be invited — they weren't found, aren't active, have no contact email, or are already invited");
    return { added, skipped: input.supplierIds.length - added };
  },
});

export const rfqAssistant: AgentDef = {
  key: "rfq-assistant",
  title: "RFQ Assistant",
  description: "Turns a sourcing brief into a structured request — the items to quote and the questions to ask — and shortlists the best-fit suppliers from your supplier list.",
  module: "SOURCING",
  schedule: null,
  maxSteps: 8,
  requireWriteBeforeFinish: true,
  timeBudgetMs: 120_000, // free-tier models can be slow and rate-limited
  launch: { label: "Open a sourcing event to use it", href: "/dashboard/sourcing" },
  inputSchema: z.object({ eventId: z.string().min(1), instruction: z.string().max(1000).optional() }),
  instructions: `You help buyers set up a request for quotation. Load the event, then:
1. From its brief, call propose_items ONCE with the concrete items suppliers should price (description, quantity, unit, and a specification where useful) and 3-5 relevant questions (e.g. warranty, delivery terms, certifications, references). Keep items specific and unambiguous.
2. Call list_supplier_candidates (use the event's category as the filter if it has one), then call propose_invites ONCE with the 3-5 best-fit suppliers, preferring preferred suppliers, higher ratings and lower risk, and explain your choice in the rationale.
Never invent facts that are not in the brief: quantities, specifications, dates or prices. If the brief lacks a quantity use 1 and say in the specification that it is to be confirmed. If there are no suitable candidates, say so instead of inviting poorly matched suppliers (propose_items is still required).`,
  kickoff: input => `Event ID: ${input?.eventId}. ${input?.instruction ? `Instruction: ${input.instruction}` : "Set up this request: draft the items and questions and shortlist suppliers."}`,
  tools: [getEvent, listCandidates, proposeItems, proposeInvites],
};
