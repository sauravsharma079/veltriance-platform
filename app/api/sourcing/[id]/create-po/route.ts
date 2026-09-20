import { NextRequest, NextResponse } from "next/server";
import { sourcingAccess } from "@/lib/sourcing-access";
import { moduleGuard } from "@/lib/licensing";
import { createPoFromAward } from "@/lib/sourcing-actions";

/** Turns an awarded event straight into a draft purchase order (for spot buys that don't need a contract). */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await sourcingAccess();
  if ("error" in a) return a.error;
  const blocked = moduleGuard(a.org, "INTAKE_TO_PO");
  if (blocked) return blocked;
  const r = await createPoFromAward({ org: a.org, profile: a.profile, id: (await ctx.params).id });
  return NextResponse.json(r.json, { status: r.status });
}
