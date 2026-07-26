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

  const pendingStep = requisition.approvalSteps.find((s) => s.status === "PENDING");
  const canAct = pendingStep ? canActOnStep(pendingStep, profile) : false;

  return NextResponse.json({ requisition, canAct });
}
