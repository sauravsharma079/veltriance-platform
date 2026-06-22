import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const existing = await prisma.user.findUnique({ where: { authId: data.user.id } });
  if (existing) {
    // Already provisioned (e.g. they clicked the confirmation link twice).
    return NextResponse.redirect(`${origin}${existing.onboardingComplete ? "/dashboard" : "/onboarding"}`);
  }

  const pendingOrgSlug = data.user.user_metadata?.pendingOrgSlug as string | undefined;
  const pendingOrgName = data.user.user_metadata?.pendingOrgName as string | undefined;
  const name =
    (data.user.user_metadata?.name as string) ||
    (data.user.user_metadata?.full_name as string) ||
    data.user.email!.split("@")[0];

  // ── Flow 1: this confirmation completes a brand-new workspace creation ──
  if (pendingOrgSlug && pendingOrgName) {
    const organization = await prisma.organization.upsert({
      where: { slug: pendingOrgSlug },
      update: {},
      create: { name: pendingOrgName, slug: pendingOrgSlug },
    });
    await prisma.user.create({
      data: {
        organizationId: organization.id,
        authId: data.user.id,
        email: data.user.email!,
        name,
        role: "ADMIN",
      },
    });
    const baseHost = origin.replace(/^https?:\/\//, "").replace(/:\d+$/, "");
    const protocol = origin.startsWith("https") ? "https" : "http";
    const port = origin.match(/:(\d+)$/)?.[0] ?? "";
    return NextResponse.redirect(`${protocol}://${organization.slug}.${baseHost}${port}/onboarding`);
  }

  // ── Flow 2: joining an existing organization via its subdomain ──
  const organization = await getCurrentOrganization();
  if (!organization) {
    return NextResponse.redirect(`${origin.replace(/\/\/[^.]+\./, "//")}/workspace-not-found`);
  }

  await prisma.user.create({
    data: {
      organizationId: organization.id,
      authId: data.user.id,
      email: data.user.email!,
      name,
    },
  });

  return NextResponse.redirect(`${origin}/onboarding`);
}
