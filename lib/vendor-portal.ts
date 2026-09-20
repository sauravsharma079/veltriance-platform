import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { newSigningToken, publicBaseUrl, sha256 } from "@/lib/contracts";
import { checklistFor } from "@/lib/onboarding";

/** Where a vendor completes their own onboarding. The token is the credential; only its hash is stored. */
export function portalUrl(token: string, origin?: string): string {
  return `${publicBaseUrl(origin)}/onboard/${token}`;
}

export async function supplierByPortalToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  return prisma.supplier.findUnique({ where: { portalTokenHash: sha256(token) }, include: { organization: { select: { id: true, name: true } } } });
}

export type PortalInvite = { link: string; emailed: boolean; emailNote?: string; missing: string[] };

/**
 * Issues a fresh personal onboarding link (any earlier one stops working) and emails it to the
 * vendor, listing exactly what's still needed. The first send is an invitation; later sends are
 * reminders. The link is always returned too, so a buyer can pass it on if email doesn't arrive.
 */
export async function sendVendorPortalInvite(opts: {
  supplierId: string; orgName: string; origin?: string; requestedBy: string; note?: string;
}): Promise<PortalInvite> {
  const data = await checklistFor(opts.supplierId);
  if (!data) throw new Error("Supplier not found");
  const { supplier, checklist } = data;
  if (!supplier.contactEmail) throw new Error(`${supplier.name} has no contact email on file — add one first`);

  const { token, tokenHash } = newSigningToken();
  const reminder = !!supplier.portalInvitedAt;
  await prisma.supplier.update({
    where: { id: supplier.id },
    data: { portalTokenHash: tokenHash, portalInvitedAt: supplier.portalInvitedAt ?? new Date(), ...(reminder && { onboardingReminders: { increment: 1 }, lastOnboardingReminderAt: new Date() }) },
  });
  const link = portalUrl(token, opts.origin);
  const missing = checklist.missing.map(m => m.label);
  const list = missing.length ? `\nStill needed:\n${missing.slice(0, 15).map(m => `  • ${m}`).join("\n")}${missing.length > 15 ? `\n  …and ${missing.length - 15} more` : ""}\n` : "\nEverything required is in — just review and submit.\n";
  const text = `Hello ${supplier.contactName ?? supplier.name},\n\n${reminder ? `A reminder: ${opts.orgName} is waiting for you to finish supplier onboarding` : `${opts.orgName} would like to work with ${supplier.name}, and asks you to complete supplier onboarding`}.\n${opts.note ? `\n${opts.note}\n` : ""}${list}\nComplete it securely here — no account needed:\n${link}\n\nThis link is personal to you — please don't forward it. It stays valid until you finish, and a new one replaces it if we send another.\n\n${opts.orgName}`;
  const sent = await sendEmail({ to: supplier.contactEmail, subject: `${reminder ? "Reminder: " : ""}Supplier onboarding for ${opts.orgName}`, text });
  return { link, emailed: sent.sent, missing, ...(sent.sent === false && { emailNote: sent.reason }) };
}
