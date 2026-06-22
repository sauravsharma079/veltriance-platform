import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore when
            // middleware is refreshing the session.
          }
        },
      },
    }
  );
}

/**
 * Returns the current authenticated user + their app-level profile row, or null.
 *
 * Critically, this also enforces tenant isolation: if a logged-in user's session
 * somehow ends up on a different organization's subdomain than the one their
 * profile belongs to, this returns null rather than the profile — callers should
 * treat that exactly like "not logged in" rather than silently using cross-tenant
 * data. In normal operation this can't happen (Supabase session cookies are
 * scoped to the subdomain they were issued on), but this is the backstop.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { prisma } = await import("@/lib/prisma");
  const { getCurrentOrganization } = await import("@/lib/tenant");

  const [profile, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);

  if (!profile || !organization || profile.organizationId !== organization.id) {
    return null;
  }

  return { authUser: user, profile, organization };
}
