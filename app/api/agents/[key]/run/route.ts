import { NextRequest, NextResponse } from "next/server";
import { agentAccess } from "@/lib/agents/access";
import { getAgent } from "@/lib/agents/registry";
import { runAgent } from "@/lib/agents/runtime";
import { llmConfigured } from "@/lib/agents/llm";
import { hasModule } from "@/lib/licensing";
import { errorMessage } from "@/lib/errors";

export const maxDuration = 60;

export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const a = await agentAccess();
  if ("error" in a) return a.error;
  const def = getAgent((await ctx.params).key);
  if (!def) return NextResponse.json({ error: "Unknown agent" }, { status: 404 });
  if (!hasModule(a.org, def.module))
    return NextResponse.json({ error: `${def.title} isn't included in your license.`, code: "MODULE_NOT_LICENSED", module: def.module }, { status: 403 });
  if (!llmConfigured())
    return NextResponse.json({ error: "No LLM is configured on the server (set GROQ_API_KEY or GEMINI_API_KEY)." }, { status: 503 });
  let input: Record<string, unknown> | undefined;
  if (def.inputSchema) {
    const body = await req.json().catch(() => null);
    const parsed = def.inputSchema.safeParse(body?.input ?? {});
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 422 });
    input = parsed.data;
  }
  try {
    const run = await runAgent(def, a.org, { trigger: "MANUAL", input });
    return NextResponse.json({ run });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 409 });
  }
}
