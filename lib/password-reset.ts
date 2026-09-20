import { createClient as createAdminClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { workspaceOrigin } from "@/lib/user-invite";

const THROTTLE_MS = 60_000;

/**
 * Emails a "choose a new password" link. Used by the login page's "Forgot password?" and it
 * is also how someone who accepted an invitation without setting a password gets back in.
 *
 * Sent through Resend, not Supabase's own mail service (rate-limited, and separate from our
 * email setup). The caller must respond identically whatever this returns, so the form can't
 * be used to discover who has an account.
 */
export async function requestPasswordReset(opts: {
  organization: { id: string; name: string };
  email: string;
  origin: string;
}): Promise<"sent" | "throttled" | "unknown"> {
  const email = opts.email.trim().toLowerCase();
  const user = await prisma.user.findFirst({ where: { organizationId: opts.organization.id, email: { equals: email, mode: "insensitive" } } });
  if (!user) return "unknown";
  if (user.passwordResetSentAt && Date.now() - user.passwordResetSentAt.getTime() < THROTTLE_MS) return "throttled";

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const res = await admin.auth.admin.generateLink({ type: "recovery", email });
  const hashed = res.data?.properties?.hashed_token;
  if (res.error || !hashed) return "unknown"; // no sign-in exists yet (invited but never accepted)

  await prisma.user.update({ where: { id: user.id }, data: { passwordResetSentAt: new Date() } });
  const link = `${workspaceOrigin(opts.origin)}/auth/set-password?token_hash=${encodeURIComponent(hashed)}&next=/dashboard`;
  await sendEmail({
    to: user.email,
    subject: `Reset your ${opts.organization.name} password`,
    text: `Hello ${user.name},\n\nSomeone asked to set a new password for your ${opts.organization.name} account on Veltriance. If that was you, choose one here:\n${link}\n\nThis link can be used once and expires soon. If you didn't ask for this, you can ignore this email — your password won't change.\n\n${opts.organization.name}`,
  });
  return "sent";
}
