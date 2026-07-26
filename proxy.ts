import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

  const HOST_MAP: Record<string, string> = {
    "localhost":               "ace",
    "127.0.0.1":              "ace",
    "ace.localhost":          "ace",
    "app.veltriance.com":     "ace",
    "veltriance-platform.vercel.app": "ace",
  };

  const slug = HOST_MAP[hostname] ?? "ace";
  response.headers.set("x-tenant-slug", slug);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
