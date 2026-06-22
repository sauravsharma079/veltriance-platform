import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { TENANT_HEADER } from "@/lib/constants";

/**
 * Extracts the tenant subdomain from the request host, e.g.
 *   acme.veltriance-platform.com  → "acme"
 *   acme.localhost:3000           → "acme"  (works out of the box in Chrome/Edge,
 *                                             no /etc/hosts edits needed for local dev)
 *   veltriance-platform.com       → null    (root domain — no tenant)
 *   localhost:3000                → null
 *
 * NEXT_PUBLIC_ROOT_DOMAIN must match whatever you've configured in Vercel's
 * project domains. For local dev this defaults to "localhost:3000".
 */
function extractSlug(host: string): string | null {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";
  const cleanHost = host.replace(/:\d+$/, ""); // strip port for comparison
  const cleanRoot = rootDomain.replace(/:\d+$/, "");

  if (cleanHost === cleanRoot || cleanHost === `www.${cleanRoot}`) return null;
  if (!cleanHost.endsWith(`.${cleanRoot}`)) return null; // not a subdomain of our root at all

  const slug = cleanHost.slice(0, -(`.${cleanRoot}`.length));
  return slug || null;
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const slug = extractSlug(host);

  // Make the resolved tenant slug available to Server Components / API routes,
  // which run in the Node.js runtime and can safely query Prisma — middleware
  // itself runs on the Edge runtime and deliberately does NOT touch the database.
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set(TENANT_HEADER, slug ?? "");

  let response = NextResponse.next({ request: { headers: forwardedHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: forwardedHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginOrSignup =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup");
  const isAuthCallback = request.nextUrl.pathname.startsWith("/auth");
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/onboarding");

  // Root domain (no tenant resolved): the only thing that makes sense here is
  // creating a new organization. Push login/signup/dashboard attempts back
  // there — but always let /auth/callback through untouched, since that's
  // exactly where the create-organization email confirmation link lands.
  if (!slug) {
    if (isProtectedRoute || isLoginOrSignup) {
      const url = request.nextUrl.clone();
      url.pathname = "/create-organization";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // On a subdomain: normal auth-route protection, scoped to this tenant.
  // (/auth/callback is intentionally excluded from the "logged in, bounce to
  // dashboard" rule below — at the moment that request arrives, the session
  // from the confirmation/OAuth code hasn't been established yet, so `user`
  // is naturally null here anyway and this falls through correctly.)
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginOrSignup && !isAuthCallback) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
