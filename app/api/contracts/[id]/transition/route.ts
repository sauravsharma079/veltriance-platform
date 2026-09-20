import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { contractAccess } from "@/lib/contracts-access";
import { TRANSITIONS } from "@/lib/contracts";
import { inviteSignatory, type InviteResult } from "@/lib/contract-invites";

const schema = z.object({ action: z.enum(["share", "submit", "return", "approve", "cancel", "terminate"]), reason: z.string().trim().max(1000).optional() });

/**
 * Moves a contract through its lifecycle. Every rule lives here, server-side:
 * the UI only offers buttons; it can't be used to skip a step.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await contractAccess();
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unknown action" }, { status: 422 });
  const { action, reason } = parsed.data;
  const rule = TRANSITIONS[action];

  const contract = await prisma.contract.findFirst({
    where: { id, organizationId: a.org.id },
    include: { signatories: true, versions: { where: {}, orderBy: { versionNumber: "desc" }, take: 1, select: { body: true } } },
  });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!rule.from.includes(contract.status))
    return NextResponse.json({ error: `You can't ${action} a contract that is ${contract.status.replace("_", " ").toLowerCase()}` }, { status: 422 });

  const suppliers = contract.signatories.filter(s => s.party === "SUPPLIER");
  const buyers = contract.signatories.filter(s => s.party === "BUYER");
  const body = contract.versions[0]?.body ?? "";

  if (action === "share" && suppliers.length === 0) return NextResponse.json({ error: "Add at least one supplier contact first — they need a link to review the draft" }, { status: 422 });
  if ((action === "submit" || action === "share") && body.trim().length < 50) return NextResponse.json({ error: "The contract has no text yet" }, { status: 422 });
  if (action === "return" && !reason) return NextResponse.json({ error: "Say why you're sending it back" }, { status: 422 });
  if (action === "terminate" && !reason) return NextResponse.json({ error: "A reason is required to terminate" }, { status: 422 });
  if (action === "approve") {
    // Separation of duties: nobody approves a contract they own.
    if (contract.ownerId === a.profile.id) return NextResponse.json({ error: "You own this contract, so someone else has to approve it" }, { status: 403 });
    if (buyers.length === 0 || suppliers.length === 0) return NextResponse.json({ error: "Add at least one signatory for each side before approving" }, { status: 422 });
  }

  // Only one request can win the move; a double-click or race gets a 409.
  const moved = await prisma.contract.updateMany({
    where: { id, status: { in: rule.from } },
    data: {
      status: rule.to,
      ...(action === "approve" && { approvedById: a.profile.id, approvedAt: new Date() }),
      ...(action === "terminate" && { terminatedAt: new Date(), terminationReason: reason }),
    },
  });
  if (moved.count === 0) return NextResponse.json({ error: "The contract changed while you were working — reload and try again" }, { status: 409 });

  if (reason) await prisma.contractComment.create({ data: { contractId: id, authorType: "BUYER", authorName: a.profile.name, body: `${action === "return" ? "Returned for changes" : action === "terminate" ? "Terminated" : "Note"}: ${reason}`, internal: action !== "terminate", versionNumber: contract.currentVersion } });

  const origin = new URL(req.url).origin;
  let invites: InviteResult[] = [];
  const cinfo = { title: contract.title, contractNumber: contract.contractNumber };
  if (action === "share") {
    invites = await Promise.all(suppliers.map(s => inviteSignatory({ signatory: s, contract: cinfo, orgName: a.org.name, origin, purpose: "negotiate" })));
  } else if (action === "approve") {
    invites = await Promise.all(contract.signatories.map(s => inviteSignatory({ signatory: s, contract: cinfo, orgName: a.org.name, origin, purpose: "sign" })));
  }

  await logAudit({
    organizationId: a.org.id, userId: a.profile.id, userName: a.profile.name,
    action: action === "approve" ? "APPROVED" : action === "cancel" ? "CANCELLED" : action === "return" ? "REJECTED" : action === "submit" ? "SUBMITTED" : "UPDATED",
    entity: "CONTRACT", entityId: id, entityLabel: `${contract.contractNumber} ${contract.title}`, details: { transition: action, to: rule.to, reason },
  });
  return NextResponse.json({ status: rule.to, invites });
}
