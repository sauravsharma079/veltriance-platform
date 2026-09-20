import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * Hit when an invited user clicks the link in their email (see lib/user-invite.ts).
 * The link carries a one-time token hash; we verify it server-side, which signs the
 * user in, then link that sign-in to the User stub the admin created.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") === "magiclink" ? "magiclink" : "invite";
  const code = searchParams.get("code"); // older links, from Supabase's own invite email
  const token = searchParams.get("token");

  if (!tokenHash && !code) return NextResponse.redirect(`${origin}/login?error=invite_invalid`);

  const supabase = await createClient();
  const { data, error } = tokenHash
    ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    : await supabase.auth.exchangeCodeForSession(code!);
  if (error || !data.user) return NextResponse.redirect(`${origin}/login?error=invite_expired`);

  if (token) {
    const stub = await prisma.user.findUnique({ where: { inviteToken: token } });
    // The person who verified the link must be the person who was invited.
    if (stub && stub.email.toLowerCase() !== (data.user.email ?? "").toLowerCase()) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=invite_invalid`);
    }
    if (stub && (!stub.authId || stub.authId.startsWith("pending_"))) {
      await prisma.user.update({ where: { id: stub.id }, data: { authId: data.user.id, inviteToken: null, inviteStatus: "ACTIVE", onboardingComplete: false } });
      // Same host: the session cookie was just set here, so this is where they stay signed in.
      // Invited users have no password yet, so they choose one first, then complete their profile.
      return NextResponse.redirect(`${origin}/auth/set-password?next=/onboarding`);
    }
  }
  return NextResponse.redirect(`${origin}/dashboard`);
}
