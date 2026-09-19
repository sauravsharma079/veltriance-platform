import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { agentAccess } from "@/lib/agents/access";

/** The approval inbox: pending by default, or ?status=EXECUTED etc. */
export async function GET(req: NextRequest) {
  const a = await agentAccess();
  if ("error" in a) return a.error;
  const status = req.nextUrl.searchParams.get("status") ?? "PENDING";
  if (!["PENDING", "EXECUTED", "REJECTED", "FAILED"].includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 422 });
  const actions = await prisma.agentAction.findMany({
    where: { organizationId: a.org.id, status: status as "PENDING" },
    orderBy: { createdAt: "desc" }, take: 50,
  });
  return NextResponse.json({ actions });
}
