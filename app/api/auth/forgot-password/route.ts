import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentOrganization } from "@/lib/tenant";
import { requestPasswordReset } from "@/lib/password-reset";
import { errorMessage } from "@/lib/errors";

const schema = z.object({ email: z.string().trim().email() });

/** Public. Always answers the same way, so it can't be used to find out who has an account. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address" }, { status: 422 });
  const organization = await getCurrentOrganization();
  if (organization) {
    try { await requestPasswordReset({ organization, email: parsed.data.email, origin: req.nextUrl.origin }); }
    catch (e) { console.error("[forgot-password]", errorMessage(e)); }
  }
  return NextResponse.json({ ok: true });
}
