import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { agentAccess } from "@/lib/agents/access";
import { AGENTS } from "@/lib/agents/registry";
import { llmConfigured, activeProvider } from "@/lib/agents/llm";
import { hasModule } from "@/lib/licensing";

export async function GET() {
  const a = await agentAccess();
  if ("error" in a) return a.error;
  const lastRuns = await prisma.agentRun.findMany({
    where: { organizationId: a.org.id }, orderBy: { startedAt: "desc" }, take: 50,
    select: { agentKey: true, status: true, summary: true, startedAt: true },
  });
  return NextResponse.json({
    autonomy: a.org.agentAutonomy,
    canConfigure: a.profile.role === "ADMIN",
    llm: { configured: llmConfigured(), provider: activeProvider() },
    agents: AGENTS.map(g => ({
      key: g.key, title: g.title, description: g.description, schedule: g.schedule, launch: g.launch ?? null,
      licensed: hasModule(a.org, g.module),
      lastRun: lastRuns.find(r => r.agentKey === g.key) ?? null,
    })),
  });
}
