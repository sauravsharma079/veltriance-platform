import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { checklistFor } from "@/lib/onboarding";
import { sendVendorPortalInvite } from "@/lib/vendor-portal";
import { defineTool, type AgentDef } from "@/lib/agents/runtime";

const AGENT_NAME = "Onboarding Agent";
const REMIND_EVERY_DAYS = 4;   // never nudge a vendor more often than this
const MAX_REMINDERS = 4;       // after this, stop and hand it to a human
const daysAgo = (d: Date | null) => (d ? Math.floor((Date.now() - d.getTime()) / 86_400_000) : null);

async function findCases(organizationId: string) {
    const pending = await prisma.agentAction.findMany({ where: { organizationId: organizationId, agentKey: "onboarding-agent", status: "PENDING" }, select: { input: true } });
    const queued = new Set(pending.map(p => (p.input as { supplierId?: string })?.supplierId).filter((x): x is string => !!x));
    const suppliers = await prisma.supplier.findMany({ where: { organizationId: organizationId, status: "PENDING_APPROVAL" }, orderBy: { createdAt: "asc" }, take: 25, select: { id: true } });
    const cases = [];
    for (const { id } of suppliers) {
      if (queued.has(id)) continue; // something is already waiting for a human to approve
      const d = await checklistFor(id);
      if (!d) continue;
      const s = d.supplier;
      const submitted = !!s.portalSubmittedAt;
      const lastTouch = s.lastOnboardingReminderAt ?? s.portalInvitedAt;
      const rec = s.onboardingRecommendation as { at?: string } | null;
      const needsInvite = !s.portalInvitedAt && !!s.contactEmail;
      const dueReminder = !!s.portalInvitedAt && !submitted && s.onboardingReminders < MAX_REMINDERS && (daysAgo(lastTouch) ?? 99) >= REMIND_EVERY_DAYS;
      const needsRecommendation = submitted && d.checklist.readyForReview && (!rec?.at || new Date(rec.at) < s.portalSubmittedAt!);
      const exhausted = !!s.portalInvitedAt && !submitted && s.onboardingReminders >= MAX_REMINDERS;
      const noEmail = !s.contactEmail && !s.portalInvitedAt;
      if (!(needsInvite || dueReminder || needsRecommendation || exhausted || noEmail)) continue;
      const domains = ((s.riskBreakdown as { domains?: { domain: string; score: number; rationale: string[] }[] } | null)?.domains ?? []).filter(x => x.score >= 40).map(x => `${x.domain} (${x.score}): ${x.rationale.join(" ")}`);
      cases.push({
        supplierId: s.id, name: s.name, country: s.country, category: s.category, stage: s.onboardingStage,
        daysInOnboarding: daysAgo(s.createdAt), hasContactEmail: !!s.contactEmail,
        invited: !!s.portalInvitedAt, daysSinceLastContact: daysAgo(lastTouch), remindersSent: s.onboardingReminders, submittedByVendor: submitted,
        checklistPercent: d.checklist.percent, stillMissing: d.checklist.missing.map(m => `${m.label}${m.status === "invalid" ? ` (${m.detail ?? "invalid"})` : ""}`),
        readyForReview: d.checklist.readyForReview, riskLevel: s.riskLevel, riskScore: s.riskScore, riskConcerns: domains,
        whatToDo: needsRecommendation ? "write_recommendation" : needsInvite ? "send_invitation" : dueReminder ? "send_reminder" : exhausted ? "escalate_to_human (reminders exhausted — do NOT contact again)" : "cannot_contact (no email on file — tell a human)",
      });
    }
    return { count: cases.length, cases };
}

const listCases = defineTool({
  name: "list_onboarding_cases",
  description: "Lists new vendors still in onboarding that need something done: an invitation to be sent, a reminder to be sent, or a recommendation to be written. Includes each one's checklist of what's missing, risk level and risk reasons.",
  risk: "read",
  input: z.object({}),
  async run(ctx) { return findCases(ctx.organizationId); },
});

const sendLink = defineTool({
  name: "send_vendor_onboarding_link",
  description: "Sends a vendor their personal onboarding link by email — an invitation the first time, a reminder after that. The email itself lists exactly what is still missing, so keep the optional note to one friendly sentence.",
  risk: "write",
  input: z.object({ supplierId: z.string().min(1), note: z.string().max(300).optional() }),
  execInput: z.object({ supplierId: z.string().min(1), note: z.string().max(300).optional(), supplierName: z.string().optional() }),
  // Attach the name so the person approving sees who this is for, not an ID.
  async prepare(ctx, input) {
    const s = await prisma.supplier.findFirst({ where: { id: input.supplierId, organizationId: ctx.organizationId }, select: { name: true } });
    if (!s) throw new Error("Supplier not found");
    return { ...input, supplierName: s.name };
  },
  async run(ctx, input) {
    // The real limits live here, whatever the model decides.
    const s = await prisma.supplier.findFirst({ where: { id: input.supplierId, organizationId: ctx.organizationId }, include: { organization: { select: { name: true } } } });
    if (!s) throw new Error("Supplier not found");
    if (s.status !== "PENDING_APPROVAL") throw new Error(`${s.name} isn't awaiting onboarding`);
    if (!s.contactEmail) throw new Error(`${s.name} has no contact email on file`);
    if (s.portalSubmittedAt) throw new Error(`${s.name} has already submitted — no reminder needed`);
    if (s.portalInvitedAt) {
      if (s.onboardingReminders >= MAX_REMINDERS) throw new Error(`${s.name} has already had ${MAX_REMINDERS} reminders — a person should follow up`);
      const since = daysAgo(s.lastOnboardingReminderAt ?? s.portalInvitedAt) ?? 99;
      if (since < REMIND_EVERY_DAYS) throw new Error(`${s.name} was contacted ${since} day(s) ago — too soon to remind`);
    }
    const invite = await sendVendorPortalInvite({ supplierId: s.id, orgName: s.organization.name, requestedBy: AGENT_NAME, note: input.note });
    // The old link is replaced as soon as a new one is issued, so an undelivered email must not pass silently.
    if (!invite.emailed) throw new Error(`The email to ${s.name} could not be delivered (${invite.emailNote ?? "unknown reason"}). A person should re-send their link from the supplier page.`);
    return { supplier: s.name, sent: s.portalInvitedAt ? "reminder" : "invitation", stillMissing: invite.missing.length };
  },
});

const saveRecommendation = defineTool({
  name: "save_onboarding_recommendation",
  description: "Records your recommendation on a vendor who has submitted a complete onboarding, for the human approver to see. You recommend only — you cannot approve or reject. 'approve' is only accepted when the checklist is complete and risk is LOW or MEDIUM.",
  risk: "write",
  input: z.object({
    supplierId: z.string().min(1),
    decision: z.enum(["approve", "request_changes", "investigate"]),
    reasoning: z.string().min(40).max(1200),
  }),
  execInput: z.object({ supplierId: z.string().min(1), decision: z.enum(["approve", "request_changes", "investigate"]), reasoning: z.string().min(40).max(1200), supplierName: z.string().optional() }),
  async prepare(ctx, input) {
    const s = await prisma.supplier.findFirst({ where: { id: input.supplierId, organizationId: ctx.organizationId }, select: { name: true } });
    if (!s) throw new Error("Supplier not found");
    return { ...input, supplierName: s.name };
  },
  async run(ctx, input) {
    const d = await checklistFor(input.supplierId);
    if (!d || d.supplier.organizationId !== ctx.organizationId) throw new Error("Supplier not found");
    const s = d.supplier;
    if (s.status !== "PENDING_APPROVAL") throw new Error(`${s.name} isn't awaiting onboarding`);
    if (!s.portalSubmittedAt) throw new Error(`${s.name} hasn't submitted their onboarding yet`);
    if (input.decision === "approve") {
      if (!d.checklist.readyForReview) throw new Error("Can't recommend approval while items are missing or invalid");
      if (s.riskLevel === "HIGH" || s.riskLevel === "CRITICAL") throw new Error(`Can't recommend approval at ${s.riskLevel} risk — recommend 'investigate'`);
    }
    await prisma.supplier.update({ where: { id: s.id }, data: { onboardingRecommendation: { decision: input.decision, reasoning: input.reasoning, at: new Date().toISOString(), by: AGENT_NAME, riskLevel: s.riskLevel, riskScore: s.riskScore, checklistPercent: d.checklist.percent } } });
    await logAudit({ organizationId: ctx.organizationId, userName: AGENT_NAME, action: "UPDATED", entity: "SUPPLIER", entityId: s.id, entityLabel: s.name, details: { recommendation: input.decision } });
    return { supplier: s.name, decision: input.decision };
  },
});

export const onboardingAgent: AgentDef = {
  key: "onboarding-agent",
  title: "Supplier Onboarding Agent",
  description: "Gets new vendors through onboarding with minimal effort from your team: invites them, chases what's missing, and — once they've finished — recommends whether to approve. Approval itself stays with a person.",
  module: "SUPPLIER_RISK",
  schedule: "daily",
  maxSteps: 16,
  timeBudgetMs: 90_000,
  instructions: `You move new vendors through supplier onboarding. Call list_onboarding_cases, then handle each case according to its "whatToDo":
- send_invitation or send_reminder: call send_vendor_onboarding_link once for that supplier. The email already lists what's missing, so at most add one warm, brief sentence as the note.
- write_recommendation: this is YOUR task, not a human's — call save_onboarding_recommendation once. (A person makes the final approval; you write the advice they use.) Decide from the facts given — approve only if the checklist is complete and risk is LOW or MEDIUM; investigate if risk is HIGH/CRITICAL or the concerns are serious; request_changes if information looks inconsistent or thin. In your reasoning cite the checklist and the specific risk concerns, in plain language a busy approver can act on.
- escalate_to_human or cannot_contact: take no action on that vendor — just mention them in your final summary so a person follows up.
Never contact a vendor more than once, never invent facts, and never claim to have approved anyone: you cannot approve. Handle every case once, then finish with a short summary of what you did and who needs a human.`,
  // Models like to handle the first few cases and call the rest "needs a human". Only vendors marked
  // escalate/cannot_contact are genuinely for a human; anything else still listed is unfinished work.
  async remainingWork(ctx) {
    const { cases } = await findCases(ctx.organizationId);
    const todo = cases.filter(c => /^(write_recommendation|send_invitation|send_reminder)/.test(c.whatToDo));
    if (todo.length === 0) return null;
    return `You are not finished. These vendors still need action, and it is your job to do it now: ${todo.map(c => `${c.name} (${c.whatToDo.split(" ")[0]}, supplierId ${c.supplierId})`).join("; ")}. Use the matching tool for each one (send_vendor_onboarding_link, or save_onboarding_recommendation), then finish. Do not leave recommendations for a human — writing them is your task; a person only makes the final approval.`;
  },
  kickoff: () => "Review the vendors in onboarding and do what each one needs.",
  tools: [listCases, sendLink, saveRecommendation],
};
