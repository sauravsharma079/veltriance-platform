import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { newSigningToken } from "@/lib/contracts";
import { bidUrl } from "@/lib/sourcing";

export type BidInvite = { inviteId: string; name: string; email: string; link: string; emailed: boolean; emailNote?: string };

/**
 * Issues a fresh personal bid link for an invited supplier (any earlier link stops
 * working) and emails it. The link is always returned as well, so the buyer can pass
 * it on themselves if email isn't set up or doesn't arrive.
 */
export async function sendBidInvite(opts: {
  invite: { id: string; name: string; contactName: string | null; email: string };
  event: { title: string; eventNumber: string; type: string; deadline: Date | null };
  orgName: string; origin: string;
}): Promise<BidInvite> {
  const { token, tokenHash } = newSigningToken();
  await prisma.sourcingInvite.update({ where: { id: opts.invite.id }, data: { tokenHash, invitedAt: new Date() } });
  const link = bidUrl(token, opts.origin);
  const due = opts.event.deadline ? ` The deadline to respond is ${opts.event.deadline.toUTCString()}.` : "";
  const text = `Hello ${opts.invite.contactName ?? opts.invite.name},\n\n${opts.orgName} invites you to respond to a ${opts.event.type}: "${opts.event.title}" (${opts.event.eventNumber}).${due}\n\nView the requirements and submit your quote here:\n${link}\n\nThis link is personal to you — please don't forward it.\n\n${opts.orgName}`;
  const sent = await sendEmail({ to: opts.invite.email, subject: `Invitation to quote: ${opts.event.title}`, text });
  return { inviteId: opts.invite.id, name: opts.invite.name, email: opts.invite.email, link, emailed: sent.sent, ...(sent.sent === false && { emailNote: sent.reason }) };
}
