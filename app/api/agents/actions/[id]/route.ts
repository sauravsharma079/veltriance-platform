import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { agentAccess } from "@/lib/agents/access";
import { getAgent } from "@/lib/agents/registry";
import { decideAction, NotFoundError } from "@/lib/agents/runtime";
import { errorMessage } from "@/lib/errors";

const schema = z.object({ decision: z.enum(["approve", "reject"]) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await agentAccess();
  if ("error" in a) return a.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "decision must be approve or reject" }, { status: 422 });
  try {
    const action = await decideAction({
      actionId: (await ctx.params).id, organizationId: a.org.id, decision: parsed.data.decision,
      decider: { id: a.profile.id, name: a.profile.name }, find: getAgent,
    });
    return NextResponse.json({ action });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: e instanceof NotFoundError ? 404 : 409 });
  }
}
