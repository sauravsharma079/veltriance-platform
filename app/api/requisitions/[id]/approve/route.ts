import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RequisitionStatus, ApprovalStepType } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { canActOnStep } from "@/lib/approval-matrix";
import { getCurrentOrganization } from "@/lib/tenant";

const STATUS_FOR_STEP: Record<ApprovalStepType, RequisitionStatus> = {
  [ApprovalStepType.MANAGER]: RequisitionStatus.MANAGER_APPROVAL,
  [ApprovalStepType.DIRECTOR]: RequisitionStatus.DIRECTOR_APPROVAL,
  [ApprovalStepType.PROCUREMENT]: RequisitionStatus.PROCUREMENT_REVIEW,
  [ApprovalStepType.FINANCE]: RequisitionStatus.FINANCE_APPROVAL,
};

const actionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  comment: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const body = await req.json();
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const requisition = await prisma.requisition.findUnique({
    where: { id },
    include: { approvalSteps: { orderBy: { sequence: "asc" } } },
  });
  if (!requisition || requisition.organizationId !== organization.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const currentStep = requisition.approvalSteps.find((s) => s.status === "PENDING");
  if (!currentStep) {
    return NextResponse.json({ error: "No pending approval step on this requisition" }, { status: 400 });
  }

  if (!canActOnStep(currentStep, profile)) {
    return NextResponse.json({ error: "You're not authorized to act on this approval step" }, { status: 403 });
  }

  if (parsed.data.decision === "REJECT") {
    await prisma.$transaction([
      prisma.approvalStep.update({
        where: { id: currentStep.id },
        data: { status: "REJECTED", comment: parsed.data.comment, decidedAt: new Date(), approverId: profile.id },
      }),
      prisma.approvalStep.updateMany({
        where: { requisitionId: id, status: "PENDING" },
        data: { status: "SKIPPED" },
      }),
      prisma.requisition.update({ where: { id }, data: { status: "REJECTED" } }),
    ]);
    return NextResponse.json({ status: "REJECTED" });
  }

  // Approve this step, then figure out what's next.
  const nextStep = requisition.approvalSteps.find((s) => s.sequence === currentStep.sequence + 1);
  const newStatus = nextStep ? STATUS_FOR_STEP[nextStep.stepType] : RequisitionStatus.ERP_SYNC_PENDING;

  await prisma.$transaction([
    prisma.approvalStep.update({
      where: { id: currentStep.id },
      data: { status: "APPROVED", comment: parsed.data.comment, decidedAt: new Date(), approverId: profile.id },
    }),
    prisma.requisition.update({
      where: { id },
      data: { status: newStatus },
    }),
  ]);

  return NextResponse.json({ status: newStatus });
}
