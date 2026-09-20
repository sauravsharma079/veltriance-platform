import { createHmac, createHash, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { publicBaseUrl } from "@/lib/contracts";

// Approvals reach people; people don't have to go looking for them. Each approver is emailed with a
// personal one-click link (no login), and reminded and escalated if a request sits too long.

const APPROVING_STATUSES = ["SUBMITTED", "MANAGER_APPROVAL", "DIRECTOR_APPROVAL", "PROCUREMENT_REVIEW", "FINANCE_APPROVAL"] as const;
const LINK_DAYS = 5;

// ─── Signed links ────────────────────────────────────────────────────────────
// A link names one person and one requisition at one approval stage, expires, and can't be edited.
// It carries authority only while that stage is still open: once decided (in the app or by email) it
// stops working. Signed with a key derived from a server-only secret, so no extra storage is needed.

const key = () => createHash("sha256").update(`veltriance-approval-link:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`).digest();
const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export type ApprovalLink = { r: string; u: string; g: number; e: number };

export function makeApprovalToken(p: { requisitionId: string; userId: string; sequence: number }, now = Date.now()): string {
  const payload = b64(JSON.stringify({ r: p.requisitionId, u: p.userId, g: p.sequence, e: now + LINK_DAYS * 86_400_000 } satisfies ApprovalLink));
  return `${payload}.${b64(createHmac("sha256", key()).update(payload).digest())}`;
}

export function verifyApprovalToken(token: string, now = Date.now()): ApprovalLink | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig || token.length > 600) return null;
  const good = createHmac("sha256", key()).update(payload).digest();
  let given: Buffer;
  try { given = Buffer.from(sig, "base64url"); } catch { return null; }
  if (given.length !== good.length || !timingSafeEqual(given, good)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString()) as ApprovalLink;
    return typeof p.r === "string" && typeof p.u === "string" && typeof p.g === "number" && p.e > now ? p : null;
  } catch { return null; }
}

// ─── Who should be told ──────────────────────────────────────────────────────

type Person = { id: string; name: string; email: string };
const signedIn = { AND: [{ authId: { not: null } }, { NOT: { authId: { startsWith: "pending_" } } }] };

/** The current (lowest-sequence pending) group of a requisition, or null if nothing is pending. */
async function currentGroup(requisitionId: string) {
  const req = await prisma.requisition.findUnique({
    where: { id: requisitionId },
    include: { approvalSteps: { orderBy: { sequence: "asc" } }, requestor: { select: { id: true, name: true, email: true, managerId: true } }, organization: { select: { name: true, approvalReminderHours: true, approvalEscalationHours: true } } },
  });
  if (!req) return null;
  const pending = req.approvalSteps.filter(s => s.status === "PENDING");
  if (pending.length === 0) return null;
  const sequence = Math.min(...pending.map(s => s.sequence));
  return { req, sequence, steps: pending.filter(s => s.sequence === sequence) };
}

/** Everyone who can act on this group's steps and should hear about it — plus the delegate of anyone who's out of office. */
export async function groupRecipients(req: { organizationId: string; requestor: { id: string; managerId: string | null } }, steps: { stepType: string; approverId: string | null }[]): Promise<Person[]> {
  const found = new Map<string, Person>();
  const add = (u: (Person & { delegateId?: string | null; outOfOfficeUntil?: Date | null }) | null | undefined) => { if (u) found.set(u.id, { id: u.id, name: u.name, email: u.email }); };
  const org = req.organizationId;
  const byRole = (roles: string[], take = 5) => prisma.user.findMany({ where: { organizationId: org, role: { in: roles as never }, ...signedIn }, select: { id: true, name: true, email: true, delegateId: true, outOfOfficeUntil: true }, take, orderBy: { name: "asc" } });

  for (const s of steps) {
    if (s.approverId) { add(await prisma.user.findFirst({ where: { id: s.approverId, organizationId: org, ...signedIn }, select: { id: true, name: true, email: true, delegateId: true, outOfOfficeUntil: true } })); continue; }
    if (s.stepType === "MANAGER") {
      const mgr = req.requestor.managerId ? await prisma.user.findFirst({ where: { id: req.requestor.managerId, organizationId: org, ...signedIn }, select: { id: true, name: true, email: true, delegateId: true, outOfOfficeUntil: true } }) : null;
      if (mgr) add(mgr); else (await byRole(["APPROVER"])).forEach(add);
      if (!mgr && found.size === 0) (await byRole(["PROCUREMENT", "ADMIN"])).forEach(add);
    } else if (s.stepType === "DIRECTOR" || s.stepType === "PROCUREMENT") {
      const ps = await byRole(["PROCUREMENT"]); (ps.length ? ps : await byRole(["ADMIN"])).forEach(add);
    } else (await byRole(["ADMIN"])).forEach(add);
  }
  // Out of office: the delegate hears about it too (and may decide it).
  const now = new Date();
  for (const id of [...found.keys()]) {
    const u = await prisma.user.findUnique({ where: { id }, select: { delegateId: true, outOfOfficeUntil: true } });
    if (u?.delegateId && u.outOfOfficeUntil && u.outOfOfficeUntil > now) add(await prisma.user.findFirst({ where: { id: u.delegateId, organizationId: org, ...signedIn }, select: { id: true, name: true, email: true } }));
  }
  found.delete(req.requestor.id); // you don't approve your own request
  return [...found.values()];
}

const money = (n: unknown, c: string) => `${c} ${Number(String(n)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

async function emailApprovers(g: NonNullable<Awaited<ReturnType<typeof currentGroup>>>, to: Person[], origin: string | undefined, kind: "request" | "reminder", waitedHours?: number) {
  const { req } = g;
  const base = publicBaseUrl(origin);
  let emailed = 0, failed = 0; let note: string | undefined;
  for (const p of to) {
    const link = `${base}/approve/${makeApprovalToken({ requisitionId: req.id, userId: p.id, sequence: g.sequence })}`;
    const text = `Hello ${p.name},\n\n${kind === "reminder" ? `A reminder: this request has been waiting ${waitedHours ? `${Math.round(waitedHours)} hours` : "a while"} for your decision.` : `${req.requestor.name} has submitted a request that needs your approval.`}\n\n${req.title} (${req.requisitionNumber})\nAmount: ${money(req.totalAmount, req.currency)}${req.category ? `\nCategory: ${req.category}` : ""}${req.department ? `\nDepartment: ${req.department}` : ""}${req.businessJustification ? `\nWhy: ${req.businessJustification.slice(0, 300)}` : ""}${req.policyException ? `\n⚠ Flagged as a policy exception${req.policyExceptionNote ? `: ${req.policyExceptionNote}` : ""}` : ""}\n\nReview and decide in one click — no login needed:\n${link}\n\nThis link is personal to you and works until the request is decided or ${LINK_DAYS} days pass. Please don't forward it.\n\n${req.organization.name}`;
    const r = await sendEmail({ to: p.email, subject: `${kind === "reminder" ? "Reminder: " : ""}Approval needed: ${req.title} (${money(req.totalAmount, req.currency)})`, text });
    if (r.sent === false) { failed++; note = r.reason; } else emailed++;
  }
  return { emailed, failed, ...(note && { note }) };
}

/** Push the current approval stage to whoever can act on it. Call after a request is submitted or advances a stage. */
export async function notifyCurrentApprovers(opts: { requisitionId: string; origin?: string }) {
  const g = await currentGroup(opts.requisitionId);
  if (!g) return { recipients: [] as Person[], emailed: 0, failed: 0 };
  const to = await groupRecipients(g.req, g.steps);
  const r = await emailApprovers(g, to, opts.origin, "request");
  return { recipients: to, ...r };
}

// ─── Reminders and escalation ────────────────────────────────────────────────

/**
 * Run daily. A stage that has waited past the org's reminder time gets a nudge; one that has waited
 * past the escalation time is escalated to the approvers' managers (or Admins). Each happens once
 * per stage, so running it repeatedly never spams anyone.
 */
export async function runApprovalReminders(now = new Date(), origin?: string, organizationId?: string) {
  const out = { checked: 0, reminded: 0, escalated: 0 };
  // `organizationId` scopes a run to one workspace (used by tests, so they can never touch anyone else's data).
  const reqs = await prisma.requisition.findMany({ where: { status: { in: [...APPROVING_STATUSES] }, ...(organizationId && { organizationId }) }, select: { id: true } });
  for (const { id } of reqs) {
    const g = await currentGroup(id);
    if (!g) continue;
    out.checked++;
    const prev = g.req.approvalSteps.filter(s => s.sequence < g.sequence && s.decidedAt);
    const since = prev.length ? Math.max(...prev.map(s => s.decidedAt!.getTime())) : (g.req.submittedAt ?? g.steps[0].createdAt).getTime();
    const hours = (now.getTime() - since) / 3_600_000;
    const { approvalReminderHours: rH, approvalEscalationHours: eH } = g.req.organization;
    const already = { reminded: g.steps.some(s => s.remindedAt), escalated: g.steps.some(s => s.escalatedAt) };

    if (hours >= eH && !already.escalated) {
      const first = await groupRecipients(g.req, g.steps);
      const mgrIds = (await prisma.user.findMany({ where: { id: { in: first.map(p => p.id) } }, select: { managerId: true } })).map(u => u.managerId).filter((x): x is string => !!x);
      let boss = mgrIds.length ? await prisma.user.findMany({ where: { id: { in: mgrIds }, ...signedIn }, select: { id: true, name: true, email: true } }) : [];
      if (boss.length === 0) boss = await prisma.user.findMany({ where: { organizationId: g.req.organizationId, role: "ADMIN", id: { notIn: first.map(p => p.id) }, ...signedIn }, select: { id: true, name: true, email: true }, take: 3 });
      for (const b of boss) {
        await sendEmail({ to: b.email, subject: `Escalation: ${g.req.title} has waited ${Math.round(hours)} hours for approval`, text: `Hello ${b.name},\n\n"${g.req.title}" (${g.req.requisitionNumber}, ${money(g.req.totalAmount, g.req.currency)}) requested by ${g.req.requestor.name} has been waiting ${Math.round(hours)} hours for approval from ${first.map(p => p.name).join(", ") || "its approver"}.\n\nPlease follow up, or decide it yourself if you're able:\nhttps://${(process.env.NEXT_PUBLIC_ROOT_DOMAIN || "app.veltriance.com").replace(/^https?:\/\//, "")}/dashboard/approvals\n\n${g.req.organization.name}` }).catch(() => {});
      }
      await prisma.approvalStep.updateMany({ where: { id: { in: g.steps.map(s => s.id) } }, data: { escalatedAt: now, remindedAt: now } });
      out.escalated++;
    } else if (hours >= rH && !already.reminded) {
      const to = await groupRecipients(g.req, g.steps);
      await emailApprovers(g, to, origin, "reminder", hours);
      await prisma.approvalStep.updateMany({ where: { id: { in: g.steps.map(s => s.id) } }, data: { remindedAt: now } });
      out.reminded++;
    }
  }
  return out;
}
