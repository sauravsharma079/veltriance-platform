import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { canActOnStep } from "@/lib/approval-matrix";
import { getCurrentOrganization } from "@/lib/tenant";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !organization || profile.organizationId !== organization.id) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const requisition = await prisma.requisition.findUnique({
    where: { id },
    include: {
      requestor: { select: { name: true, email: true, department: true } },
      chartOfAccount: { select: { name: true, code: true } },
      lineItems: {
        include: { supplier: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      approvalSteps: { include: { approver: { select: { name: true } } }, orderBy: { sequence: "asc" } },
    },
  });

  if (!requisition || requisition.organizationId !== organization.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // RequisitionLineItem.glCoaId is a plain string, not a Prisma relation (line items
  // can each reference a different chart of accounts), so resolve it manually rather
  // than via `include` — this is what lets GL coding be shown per line, not just once
  // for the whole requisition.
  const coaIds = Array.from(new Set(requisition.lineItems.map(li => li.glCoaId).filter((v): v is string => !!v)));
  const lineCoas = coaIds.length > 0
    ? await prisma.chartOfAccount.findMany({ where: { id: { in: coaIds } }, select: { id: true, name: true, code: true } })
    : [];
  const lineCoaMap = new Map(lineCoas.map(c => [c.id, c]));
  const requisitionWithLineCoas = {
    ...requisition,
    lineItems: requisition.lineItems.map(li => ({
      ...li,
      chartOfAccount: li.glCoaId ? (lineCoaMap.get(li.glCoaId) ?? null) : null,
    })),
  };

  const pendingStep = requisition.approvalSteps.find((s) => s.status === "PENDING");
  const canAct = pendingStep ? canActOnStep(pendingStep, profile) : false;

  return NextResponse.json({ requisition: requisitionWithLineCoas, canAct });
}
