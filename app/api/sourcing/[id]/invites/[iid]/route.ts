import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sourcingAccess } from "@/lib/sourcing-access";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; iid: string }> }) {
  const a = await sourcingAccess();
  if ("error" in a) return a.error;
  const { id, iid } = await ctx.params;
  const event = await prisma.sourcingEvent.findFirst({ where: { id, organizationId: a.org.id }, select: { status: true } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Removing an invite after they may have bid would silently destroy a bid.
  if (event.status !== "DRAFT") return NextResponse.json({ error: "Suppliers can only be removed while the event is a draft" }, { status: 422 });
  const removed = await prisma.sourcingInvite.deleteMany({ where: { id: iid, eventId: id } });
  if (removed.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
