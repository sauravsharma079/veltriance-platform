import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { contractAccess } from "@/lib/contracts-access";
import { inviteSignatory } from "@/lib/contract-invites";

/** (Re)issues a signatory's link — the old one stops working — and emails it. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; sid: string }> }) {
  const a = await contractAccess();
  if ("error" in a) return a.error;
  const { id, sid } = await ctx.params;
  const contract = await prisma.contract.findFirst({ where: { id, organizationId: a.org.id }, include: { signatories: { where: { id: sid } } } });
  const signatory = contract?.signatories[0];
  if (!contract || !signatory) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const purpose = contract.status === "PENDING_SIGNATURE" ? "sign" : contract.status === "NEGOTIATION" && signatory.party === "SUPPLIER" ? "negotiate" : null;
  if (!purpose) return NextResponse.json({ error: "Links are issued when the draft is shared or the contract is approved for signing" }, { status: 422 });
  if (signatory.status === "SIGNED") return NextResponse.json({ error: "They have already signed" }, { status: 422 });
  const invite = await inviteSignatory({ signatory, contract, orgName: a.org.name, origin: new URL(req.url).origin, purpose });
  return NextResponse.json({ invite });
}
