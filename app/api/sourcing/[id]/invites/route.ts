import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sourcingAccess } from "@/lib/sourcing-access";
import { newSigningToken } from "@/lib/contracts";

// Suppliers can be added while drafting, or while open (to widen the field). Not once bidding has closed.
const OPEN_FOR_INVITES = ["DRAFT", "OPEN"];
const schema = z.object({
  supplierId: z.string().min(1).optional(),
  name: z.string().trim().min(2).max(150).optional(),
  contactName: z.string().trim().max(120).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
}).refine(d => d.supplierId || (d.name && d.email), { message: "Pick a supplier, or give a name and email" });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await sourcingAccess();
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 });
  const event = await prisma.sourcingEvent.findFirst({ where: { id, organizationId: a.org.id }, select: { status: true } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!OPEN_FOR_INVITES.includes(event.status)) return NextResponse.json({ error: "Suppliers can't be added at this stage" }, { status: 422 });

  let { name, email, contactName } = parsed.data;
  const { supplierId } = parsed.data;
  if (supplierId) {
    const sup = await prisma.supplier.findFirst({ where: { id: supplierId, organizationId: a.org.id }, select: { name: true, contactEmail: true, contactName: true, status: true } });
    if (!sup) return NextResponse.json({ error: "Supplier not found" }, { status: 422 });
    if (sup.status === "BLOCKED" || sup.status === "INACTIVE") return NextResponse.json({ error: `${sup.name} is ${sup.status.toLowerCase()} and can't be invited` }, { status: 422 });
    name = sup.name; email = email ?? sup.contactEmail ?? undefined; contactName = contactName ?? sup.contactName ?? undefined;
  }
  if (!email) return NextResponse.json({ error: "This supplier has no contact email on file — add one" }, { status: 422 });
  const dupe = await prisma.sourcingInvite.findFirst({ where: { eventId: id, OR: [{ email }, ...(supplierId ? [{ supplierId }] : [])] } });
  if (dupe) return NextResponse.json({ error: "That supplier is already invited" }, { status: 409 });

  // The link is issued when the event is published (or "Send link" is used), not here.
  const invite = await prisma.sourcingInvite.create({
    data: { eventId: id, supplierId: supplierId ?? null, name: name!, contactName: contactName ?? null, email, tokenHash: newSigningToken().tokenHash },
    select: { id: true, name: true, email: true, status: true, supplierId: true },
  });
  return NextResponse.json({ invite }, { status: 201 });
}
