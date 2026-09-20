import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sourcingAccess } from "@/lib/sourcing-access";
import { transitionEvent } from "@/lib/sourcing-actions";

const schema = z.object({ action: z.enum(["publish", "close", "award", "cancel"]), inviteId: z.string().min(1).optional(), reason: z.string().trim().max(1000).optional() });

/** Every lifecycle rule lives in lib/sourcing-actions.ts, server-side; the UI only offers buttons. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await sourcingAccess();
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unknown action" }, { status: 422 });
  const r = await transitionEvent({ org: a.org, profile: a.profile, id, ...parsed.data, origin: new URL(req.url).origin });
  return NextResponse.json(r.json, { status: r.status });
}
