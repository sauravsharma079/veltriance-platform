import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { AGENTS } from "@/lib/agents/registry";
import { runAgent } from "@/lib/agents/runtime";
import { llmConfigured } from "@/lib/agents/llm";
import { hasModule } from "@/lib/licensing";
import { errorMessage } from "@/lib/errors";
import { expireContracts } from "@/lib/contracts";
import { closeOverdueEvents } from "@/lib/sourcing";
import { runApprovalReminders } from "@/lib/approval-notify";

export const maxDuration = 300;

/**
 * Daily tick (see vercel.json). Vercel calls this with `Authorization: Bearer
 * $CRON_SECRET`. For every org licensed for Agents it runs each scheduled agent
 * whose own module is also licensed. Orgs run one after another so a free-tier
 * LLM's rate limit isn't hit by parallel calls.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer /, ""));
  if (!secret || given.length !== Buffer.byteLength(secret) || !timingSafeEqual(given, Buffer.from(secret)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Deterministic housekeeping first — needs no model, so it runs even if the LLM is down.
  const expired = await expireContracts();
  const closedEvents = await closeOverdueEvents();
  // Approval reminders and escalations are plain rules, so they run even when the AI is unavailable.
  const approvals = await runApprovalReminders().catch(e => { console.error("[cron] approval reminders failed:", e); return null; });
  if (!llmConfigured()) return NextResponse.json({ error: "No LLM configured", expiredContracts: expired, closedEvents, approvals }, { status: 503 });

  const orgs = await prisma.organization.findMany({
    where: { licensedModules: { has: "AGENTS" } },
    select: { id: true, agentAutonomy: true, licensedModules: true, licenseExpiresAt: true },
  });

  const results: { orgId: string; agent: string; status: string }[] = [];
  const started = Date.now();
  for (const org of orgs) {
    if (!hasModule(org, "AGENTS")) continue;
    for (const def of AGENTS.filter(g => g.schedule === "daily" && hasModule(org, g.module))) {
      if (Date.now() - started > 240_000) { results.push({ orgId: org.id, agent: def.key, status: "skipped: time budget" }); continue; }
      try {
        const run = await runAgent(def, org, { trigger: "SCHEDULE" });
        results.push({ orgId: org.id, agent: def.key, status: run.status });
      } catch (e) {
        results.push({ orgId: org.id, agent: def.key, status: `error: ${errorMessage(e)}` });
      }
    }
  }
  return NextResponse.json({ ran: results.length, expiredContracts: expired, closedEvents, approvals, results });
}
