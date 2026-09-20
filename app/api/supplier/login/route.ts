import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendLoginLinks } from "@/lib/supplier-session";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(200) });

/** Always answers the same way, so it can't be used to discover which addresses are suppliers. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address" }, { status: 422 });
  if (!rateLimit(`supplier-login:${parsed.data.email}`, 3, 15 * 60_000).ok) return NextResponse.json({ error: "Too many requests — please wait a few minutes." }, { status: 429 });
  await sendLoginLinks(parsed.data.email, req.nextUrl.origin).catch(e => console.error("[supplier login]", e instanceof Error ? e.message : e));
  return NextResponse.json({ ok: true });
}
