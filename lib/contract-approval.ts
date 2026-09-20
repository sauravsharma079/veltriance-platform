import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { workspaceOrigin } from "@/lib/user-invite";

/** Roles that may approve a contract. Procurement and Admins run the module; Approvers are the workspace's sign-off role. */
export const APPROVER_ROLES = ["ADMIN", "PROCUREMENT", "APPROVER"] as const;

/**
 * People who can actually approve right now: an eligible role, able to sign in (an invitation
 * that was never accepted can't approve anything), and not the contract's owner.
 */
export async function eligibleApprovers(organizationId: string, ownerId: string) {
  return prisma.user.findMany({
    where: {
      organizationId, id: { not: ownerId }, role: { in: [...APPROVER_ROLES] },
      AND: [{ authId: { not: null } }, { NOT: { authId: { startsWith: "pending_" } } }],
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
}

export type ApprovalVerdict = { allowed: true; selfApproval: boolean } | { allowed: false; reason: string };

/**
 * Who may approve. Separation of duties is the rule: nobody approves a contract they own.
 * The one exception is a workspace where no one else *can* (e.g. a single Admin), so contracts
 * don't dead-end; an Admin may then self-approve, and that is recorded in the audit trail.
 */
export async function approvalVerdict(opts: { organizationId: string; ownerId: string; approver: { id: string; role: string } }): Promise<ApprovalVerdict> {
  if (!(APPROVER_ROLES as readonly string[]).includes(opts.approver.role)) return { allowed: false, reason: "Your role can't approve contracts" };
  if (opts.approver.id !== opts.ownerId) return { allowed: true, selfApproval: false };
  const others = await eligibleApprovers(opts.organizationId, opts.ownerId);
  if (others.length > 0) return { allowed: false, reason: "You own this contract, so someone else has to approve it" };
  if (opts.approver.role !== "ADMIN") return { allowed: false, reason: "You own this contract and nobody else can approve it — ask an Admin, or invite another approver" };
  return { allowed: true, selfApproval: true };
}

/** Emails whoever has been asked to approve. Best effort: the in-app notification is the backstop. */
export async function notifyApprovers(opts: {
  contract: { id: string; title: string; contractNumber: string };
  recipients: { name: string; email: string }[];
  requestedBy: string; orgName: string; origin: string;
}): Promise<{ emailed: number; failed: number; note?: string }> {
  const link = `${workspaceOrigin(opts.origin)}/dashboard/contracts/${opts.contract.id}`;
  let emailed = 0, failed = 0; let note: string | undefined;
  for (const r of opts.recipients) {
    const res = await sendEmail({
      to: r.email,
      subject: `Contract awaiting your approval: ${opts.contract.title}`,
      text: `Hello ${r.name},\n\n${opts.requestedBy} has submitted "${opts.contract.title}" (${opts.contract.contractNumber}) for your approval at ${opts.orgName}.\n\nReview and approve it here:\n${link}\n\n${opts.orgName}`,
    });
    if (res.sent === false) { failed++; note = res.reason; } else emailed++;
  }
  return { emailed, failed, ...(note && { note }) };
}

/**
 * Which contracts an Approver may open: ones put to them, ones they already decided on (so the
 * page still works after they approve), or an unassigned one awaiting approval. Nothing else —
 * they aren't part of the contracts module.
 */
export function approverMayView(contract: { status: string; approverId: string | null; approvedById: string | null }, userId: string): boolean {
  if (contract.approverId === userId || contract.approvedById === userId) return true;
  return contract.status === "PENDING_APPROVAL" && !contract.approverId;
}
