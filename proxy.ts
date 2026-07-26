import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(req: NextRequest) {
  let response = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value)
          );
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

  const HOST_MAP: Record<string, string> = {
    "localhost":              "nexcore",
    "127.0.0.1":             "nexcore",
    "ace.localhost":         "ace",
    "nexcore.localhost":     "nexcore",
    "nexcore.veltriance.com":"nexcore",
  };

  const slug = HOST_MAP[hostname] ?? hostname.split(".")[0];
  response.headers.set("x-tenant-slug", slug);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
