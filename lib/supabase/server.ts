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

export const IMPERSONATION_COOKIE = "vt_impersonate";

/**
 * Returns the current authenticated user + their app-level profile row, or null.
 * If an admin has set the impersonation cookie, returns the impersonated user's
 * profile instead — but only after verifying the real session is still an admin
 * in the same org, so the cookie can't be forged by a non-admin.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { prisma } = await import("@/lib/prisma");
  const { getCurrentOrganization } = await import("@/lib/tenant");

  const [realProfile, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);

  if (!realProfile || !organization || realProfile.organizationId !== organization.id) {
    return null;
  }

  // Check for impersonation cookie (admin "act as user" feature)
  const cookieStore = await cookies();
  const impCookie = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  if (impCookie && realProfile.role === "ADMIN") {
    const [targetId, adminId] = impCookie.split("|");
    if (adminId === realProfile.id && targetId) {
      const targetProfile = await prisma.user.findUnique({ where: { id: targetId } });
      if (targetProfile && targetProfile.organizationId === organization.id) {
        return {
          authUser: user,
          profile: targetProfile,
          organization,
          impersonating: { realAdmin: realProfile },
        };
      }
    }
  }

  return { authUser: user, profile: realProfile, organization, impersonating: null };
}
