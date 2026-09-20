import { NextRequest, NextResponse } from "next/server";
import { onboardingAccess } from "@/lib/supplier-access";
import { checklistFor } from "@/lib/onboarding";

/** Where a supplier stands in onboarding: the checklist, whether they've been invited/submitted, and the agent's advice. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await onboardingAccess();
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const data = await checklistFor(id);
  if (!data || data.supplier.organizationId !== a.org.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const s = data.supplier;
  return NextResponse.json({
    status: s.status, stage: s.onboardingStage, hasEmail: !!s.contactEmail,
    invitedAt: s.portalInvitedAt, submittedAt: s.portalSubmittedAt, reminders: s.onboardingReminders, lastReminderAt: s.lastOnboardingReminderAt,
    riskLevel: s.riskLevel, riskScore: s.riskScore,
    recommendation: s.onboardingRecommendation ?? null,
    checklist: data.checklist,
  });
}
