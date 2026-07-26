import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * This route is hit when an invited user clicks the link in their email.
 * Supabase adds the auth code to the URL; we exchange it for a session,
 * then link the Supabase auth identity to the pre-created User stub that
 * the admin created when they sent the invite.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token = searchParams.get("token");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=invite_invalid`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=invite_expired`);
  }

  // If we have an invite token, link the Supabase auth identity to the stub
  if (token) {
    const stub = await prisma.user.findUnique({ where: { inviteToken: token } });

    if (stub && !stub.authId) {
      await prisma.user.update({
        where: { id: stub.id },
        data: {
          authId: data.user.id,
          inviteToken: null, // consume the token
          onboardingComplete: false,
        },
      });

      // Redirect to the org's subdomain for onboarding
      const org = await prisma.organization.findUnique({
        where: { id: stub.organizationId },
      });

      if (org) {
        const baseHost = origin.replace(/^https?:\/\//, "").replace(/:\d+$/, "");
        const protocol = origin.startsWith("https") ? "https" : "http";
        const port = origin.match(/:(\d+)$/)?.[0] ?? "";
        return NextResponse.redirect(
          `${protocol}://${org.slug}.${baseHost}${port}/onboarding`
        );
      }
    }
  }

  // Fallback: if no token or stub not found, send them to the dashboard
  return NextResponse.redirect(`${origin}/dashboard`);
}
