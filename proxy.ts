import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// The workspace shown when a request doesn't map to any tenant subdomain — the
// bare root domain, local dev, and Vercel's own preview URL all land here so
// the app is usable before a workspace subdomain is actually configured.
const DEFAULT_SLUG = "ace";

// Documented in .env.example / README.md as the switch for "going live with
// real client subdomains" — falls back to the actual production host so this
// keeps working even if that env var was never set in Vercel.
const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "app.veltriance.com").toLowerCase();

/**
 * Resolves a request's Host header to a tenant slug by stripping the root
 * domain suffix — e.g. "acme.app.veltriance.com" -> "acme". Previously this
 * was a hardcoded map of ~5 known hostnames that all pointed at "ace", so
 * every organization except the first one ever created was unreachable: its
 * subdomain — even once DNS resolved it — would still load "ace"'s data.
 */
function resolveSlug(hostname: string): string {
  const host = hostname.toLowerCase();

  if (host === "localhost" || host === "127.0.0.1") return DEFAULT_SLUG;
  if (host.endsWith(".localhost")) return host.slice(0, -".localhost".length) || DEFAULT_SLUG;

  if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`) return DEFAULT_SLUG;
  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    return host.slice(0, -(ROOT_DOMAIN.length + 1)) || DEFAULT_SLUG;
  }

  // Anything else unrecognized (e.g. the Vercel preview *.vercel.app URL) has
  // no subdomain to extract from.
  return DEFAULT_SLUG;
}

export async function proxy(req: NextRequest) {
  let response = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  const host     = req.headers.get("host") ?? "";
  const hostname = host.split(":")[0];
  const slug     = resolveSlug(hostname);

  response.headers.set("x-tenant-slug", slug);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
