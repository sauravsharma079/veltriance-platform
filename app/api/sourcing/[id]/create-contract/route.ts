import { NextRequest, NextResponse } from "next/server";
import { sourcingAccess } from "@/lib/sourcing-access";
import { moduleGuard } from "@/lib/licensing";
import { createContractFromAward } from "@/lib/sourcing-actions";

/** Turns an awarded event into a draft contract with the winning terms as its starting point. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await sourcingAccess();
  if ("error" in a) return a.error;
  const blocked = moduleGuard(a.org, "CONTRACTS");
  if (blocked) return blocked;
  const r = await createContractFromAward({ org: a.org, profile: a.profile, id: (await ctx.params).id });
  return NextResponse.json(r.json, { status: r.status });
}
