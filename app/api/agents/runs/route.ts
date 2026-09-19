import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { agentAccess } from "@/lib/agents/access";

export async function GET() {
  const a = await agentAccess();
  if ("error" in a) return a.error;
  const runs = await prisma.agentRun.findMany({
    where: { organizationId: a.org.id }, orderBy: { startedAt: "desc" }, take: 25,
    select: { id: true, agentKey: true, trigger: true, status: true, summary: true, error: true, steps: true, llmCalls: true, startedAt: true, finishedAt: true },
  });
  return NextResponse.json({ runs });
}
