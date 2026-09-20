import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { agentAccess } from "@/lib/agents/access";

/** The approval inbox: pending by default, or ?status=EXECUTED etc. */
export async function GET(req: NextRequest) {
  const a = await agentAccess();
  if ("error" in a) return a.error;
  const status = req.nextUrl.searchParams.get("status") ?? "PENDING";
  if (!["PENDING", "EXECUTED", "REJECTED", "FAILED"].includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 422 });
  const contractId = req.nextUrl.searchParams.get("contractId");
  const eventId = req.nextUrl.searchParams.get("eventId");
  const actions = await prisma.agentAction.findMany({
    where: {
      organizationId: a.org.id, status: status as "PENDING",
      // Actions on a contract keep its id in their input; lets a contract page show its own proposals.
      ...(contractId && { input: { path: ["contractId"], equals: contractId } }),
      ...(eventId && { input: { path: ["eventId"], equals: eventId } }),
    },
    orderBy: { createdAt: "desc" }, take: 50,
  });
  return NextResponse.json({ actions });
}
