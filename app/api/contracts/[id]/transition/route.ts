import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { contractAccess } from "@/lib/contracts-access";
import { TRANSITIONS } from "@/lib/contracts";
import { inviteSignatory, type InviteResult } from "@/lib/contract-invites";
import { approvalVerdict, eligibleApprovers, notifyApprovers } from "@/lib/contract-approval";

const schema = z.object({ action: z.enum(["share", "submit", "return", "approve", "cancel", "terminate"]), reason: z.string().trim().max(1000).optional(), approverId: z.string().min(1).optional() });

/**
 * Moves a contract through its lifecycle. Every rule lives here, server-side:
 * the UI only offers buttons; it can't be used to skip a step.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await contractAccess({ allowApprover: true });
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unknown action" }, { status: 422 });
  const { action, reason, approverId } = parsed.data;
  const rule = TRANSITIONS[action];
  // The Approver role exists to decide on contracts that were put to them — nothing else.
  if (a.profile.role === "APPROVER" && action !== "approve" && action !== "return") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
  let selfApproval = false;
  let recipients: { id: string; name: string; email: string }[] = [];
  if (action === "submit") {
    const eligible = await eligibleApprovers(a.org.id, contract.ownerId);
    if (approverId && !eligible.some(e => e.id === approverId)) return NextResponse.json({ error: "That person can't approve this contract" }, { status: 422 });
    // Don't let a contract dead-end: with nobody eligible it can only proceed if its owner is an Admin who may self-approve.
    if (eligible.length === 0 && !(contract.ownerId === a.profile.id && a.profile.role === "ADMIN"))
      return NextResponse.json({ error: "Nobody else is able to approve this yet. Invite an Admin, Procurement or Approver user first (they must have accepted their invitation)." }, { status: 422 });
    recipients = approverId ? eligible.filter(e => e.id === approverId) : eligible;
  }
  if (action === "approve" || action === "return") {
    if (contract.approverId && contract.approverId !== a.profile.id && a.profile.role !== "ADMIN")
      return NextResponse.json({ error: "This contract was sent to someone else for approval" }, { status: 403 });
  }
  if (action === "approve") {
    // Separation of duties: nobody approves a contract they own (unless nobody else can — see approvalVerdict).
    const verdict = await approvalVerdict({ organizationId: a.org.id, ownerId: contract.ownerId, approver: a.profile });
    if (verdict.allowed === false) return NextResponse.json({ error: verdict.reason }, { status: 403 });
    selfApproval = verdict.selfApproval;
    if (buyers.length === 0 || suppliers.length === 0) return NextResponse.json({ error: "Add at least one signatory for each side before approving" }, { status: 422 });
  }

  // Only one request can win the move; a double-click or race gets a 409.
  const moved = await prisma.contract.updateMany({
    where: { id, status: { in: rule.from } },
    data: {
      status: rule.to,
      ...(action === "submit" && { approverId: approverId ?? null }),
      ...(action === "return" && { approverId: null }),
      ...(action === "approve" && { approvedById: a.profile.id, approvedAt: new Date() }),
      ...(action === "terminate" && { terminatedAt: new Date(), terminationReason: reason }),
    },
  });
  if (moved.count === 0) return NextResponse.json({ error: "The contract changed while you were working — reload and try again" }, { status: 409 });

  if (reason) await prisma.contractComment.create({ data: { contractId: id, authorType: "BUYER", authorName: a.profile.name, body: `${action === "return" ? "Returned for changes" : action === "terminate" ? "Terminated" : "Note"}: ${reason}`, internal: action !== "terminate", versionNumber: contract.currentVersion } });

  const origin = new URL(req.url).origin;
  let invites: InviteResult[] = [];
  let notified: { names: string[]; emailed: number; note?: string } | null = null;
  if (action === "submit" && recipients.length > 0) {
    const n = await notifyApprovers({ contract, recipients, requestedBy: a.profile.name, orgName: a.org.name, origin });
    notified = { names: recipients.map(r => r.name), emailed: n.emailed, note: n.note };
  }
  const cinfo = { title: contract.title, contractNumber: contract.contractNumber };
  if (action === "share") {
    invites = await Promise.all(suppliers.map(s => inviteSignatory({ signatory: s, contract: cinfo, orgName: a.org.name, origin, purpose: "negotiate" })));
  } else if (action === "approve") {
    invites = await Promise.all(contract.signatories.map(s => inviteSignatory({ signatory: s, contract: cinfo, orgName: a.org.name, origin, purpose: "sign" })));
  }

  await logAudit({
    organizationId: a.org.id, userId: a.profile.id, userName: a.profile.name,
    action: action === "approve" ? "APPROVED" : action === "cancel" ? "CANCELLED" : action === "return" ? "REJECTED" : action === "submit" ? "SUBMITTED" : "UPDATED",
    entity: "CONTRACT", entityId: id, entityLabel: `${contract.contractNumber} ${contract.title}`, details: { transition: action, to: rule.to, reason, ...(selfApproval && { selfApproved: true, note: "No other approver was available" }), ...(action === "submit" && { approvers: recipients.map(r => r.name) }) },
  });
  return NextResponse.json({ status: rule.to, invites, notified, selfApproval });
}
