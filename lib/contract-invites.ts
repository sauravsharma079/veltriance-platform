import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { newSigningToken, signingUrl } from "@/lib/contracts";

export type InviteResult = { signatoryId: string; name: string; email: string; party: string; link: string; emailed: boolean; emailNote?: string };

/**
 * Issues a fresh signing link for a signatory (invalidating any earlier one) and
 * emails it. The link is always returned too: if email isn't configured, or the
 * message doesn't arrive, the buyer can pass it on themselves.
 */
export async function inviteSignatory(opts: {
  signatory: { id: string; name: string; email: string; party: string };
  contract: { title: string; contractNumber: string };
  orgName: string; origin: string; purpose: "negotiate" | "sign";
}): Promise<InviteResult> {
  const { token, tokenHash } = newSigningToken();
  await prisma.contractSignatory.update({ where: { id: opts.signatory.id }, data: { tokenHash, invitedAt: new Date() } });
  const link = signingUrl(token, opts.origin);

  const text = opts.purpose === "sign"
    ? `Hello ${opts.signatory.name},\n\n${opts.orgName} has asked you to review and sign "${opts.contract.title}" (${opts.contract.contractNumber}).\n\nOpen the agreement here:\n${link}\n\nThis link is personal to you — please don't forward it.\n\n${opts.orgName}`
    : `Hello ${opts.signatory.name},\n\n${opts.orgName} has shared a draft of "${opts.contract.title}" (${opts.contract.contractNumber}) with you for review.\n\nYou can read it, comment, and suggest changes here:\n${link}\n\nThis link is personal to you — please don't forward it.\n\n${opts.orgName}`;
  const sent = await sendEmail({ to: opts.signatory.email, subject: `${opts.purpose === "sign" ? "Please sign" : "For your review"}: ${opts.contract.title}`, text });

  return {
    signatoryId: opts.signatory.id, name: opts.signatory.name, email: opts.signatory.email, party: opts.signatory.party,
    link, emailed: sent.sent, ...(sent.sent === false && { emailNote: sent.reason }),
  };
}
