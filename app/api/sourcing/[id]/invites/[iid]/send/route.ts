import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sourcingAccess } from "@/lib/sourcing-access";
import { sendBidInvite } from "@/lib/sourcing-invites";

/** (Re)issues a supplier's bid link — the old one stops working — and emails it. Only while bidding is open. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; iid: string }> }) {
  const a = await sourcingAccess();
  if ("error" in a) return a.error;
  const { id, iid } = await ctx.params;
  const event = await prisma.sourcingEvent.findFirst({ where: { id, organizationId: a.org.id }, include: { invites: { where: { id: iid } } } });
  const invite = event?.invites[0];
  if (!event || !invite) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (event.status !== "OPEN") return NextResponse.json({ error: "Links are issued when the event is published, and only while bidding is open" }, { status: 422 });
  if (invite.status === "DECLINED") return NextResponse.json({ error: "They declined to bid" }, { status: 422 });
  const result = await sendBidInvite({ invite, event, orgName: a.org.name, origin: new URL(req.url).origin });
  return NextResponse.json({ invite: result });
}
