import { randomBytes } from "crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { publicBaseUrl } from "@/lib/contracts";

export type InviteOutcome = { emailed: boolean; link: string; emailNote?: string };

/**
 * The invitation link must open on the workspace's own address, because the session cookie
 * it creates is tied to that host. Vercel's internal *.vercel.app address isn't one a user
 * should ever be sent to, so that (and only that) is swapped for the public domain.
 */
function inviteOrigin(origin: string): string {
  return /\.vercel\.app(:\d+)?$/.test(new URL(origin).host) ? publicBaseUrl() : origin.replace(/\/$/, "");
}

/**
 * Creates a fresh invitation for a user stub and emails it through Resend.
 *
 * We used to call supabase.auth.admin.inviteUserByEmail: that sends through Supabase's own
 * mail service, which is rate-limited to a couple of messages an hour and won't deliver to
 * outside addresses until custom SMTP is set up — and it is separate from our Resend
 * configuration. Instead we ask Supabase only for a one-time token (generateLink, which
 * sends nothing) and put it in our own link, which /auth/accept-invite verifies server-side.
 *
 * The link is always returned as well, so an admin can pass it on if email fails.
 */
export async function sendUserInvite(opts: {
  user: { id: string; email: string; name: string };
  organization: { slug: string; name: string };
  origin: string;
  invitedBy: string;
}): Promise<InviteOutcome> {
  const inviteToken = randomBytes(32).toString("hex");
  await prisma.user.update({ where: { id: opts.user.id }, data: { inviteToken, invitedAt: new Date() } });

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const email = opts.user.email.toLowerCase();
  let type: "invite" | "magiclink" = "invite";
  let res = await admin.auth.admin.generateLink({ type: "invite", email, options: { data: { name: opts.user.name, organizationSlug: opts.organization.slug, organizationName: opts.organization.name } } });
  // Someone who already has a sign-in (e.g. from an earlier attempt) can't be "invited" again.
  if (res.error && /already|registered|exists/i.test(res.error.message)) {
    type = "magiclink";
    res = await admin.auth.admin.generateLink({ type: "magiclink", email });
  }
  const hashed = res.data?.properties?.hashed_token;
  if (res.error || !hashed) throw new Error(res.error?.message ?? "Could not create the invitation link");

  const link = `${inviteOrigin(opts.origin)}/auth/accept-invite?token_hash=${encodeURIComponent(hashed)}&type=${type}&token=${inviteToken}`;
  const sent = await sendEmail({
    to: opts.user.email,
    subject: `${opts.invitedBy} invited you to ${opts.organization.name} on Veltriance`,
    text: `Hello ${opts.user.name},\n\n${opts.invitedBy} has invited you to join ${opts.organization.name} on Veltriance.\n\nAccept your invitation and set up your account here:\n${link}\n\nThis link can be used once and expires soon. If it stops working, ask ${opts.invitedBy} to send a new invitation.\n\n${opts.organization.name}`,
  });
  return { emailed: sent.sent, link, ...(sent.sent === false && { emailNote: sent.reason }) };
}
