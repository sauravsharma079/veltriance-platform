import { NextRequest, NextResponse } from "next/server";
import { ApprovalStepType, RequisitionStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { resolveApprovalSteps, STATUS_FOR_STEP } from "@/lib/approval-matrix";

/**
 * POST /api/requisitions/[id]/submit
 *
 * Moves an existing DRAFT requisition into the approval chain — needed for
 * requisitions created outside the one-shot intake flow (e.g. a punchout
 * cart, which lands in DRAFT deliberately so the requestor can review
 * supplier-returned line items before they enter approval).
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [profile, organization] = await Promise.all([
      prisma.user.findUnique({ where: { authId: user.id } }),
      getCurrentOrganization(),
    ]);
    if (!profile || !organization || profile.organizationId !== organization.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const requisition = await prisma.requisition.findUnique({ where: { id } });
    if (!requisition || requisition.organizationId !== organization.id)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (requisition.status !== "DRAFT")
      return NextResponse.json({ error: "Only draft requisitions can be submitted" }, { status: 422 });

    const isOwner = requisition.requestorId === profile.id;
    const canSubmitOnBehalf = profile.role === "PROCUREMENT" || profile.role === "ADMIN";
    if (!isOwner && !canSubmitOnBehalf)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const approvalSteps = await resolveApprovalSteps(
      organization.id, Number(requisition.totalAmount), requisition.category, requisition.department
    );
    const newStatus = approvalSteps.length > 0
      ? STATUS_FOR_STEP[approvalSteps[0].stepType]
      : RequisitionStatus.APPROVED;

    const updated = await prisma.requisition.update({
      where: { id },
      data: {
        status: newStatus,
        submittedAt: new Date(),
        approvalSteps: {
          create: approvalSteps.map((step, i) => ({
            stepType: step.stepType,
            stepLabel: step.stepLabel,
            sequence: i + 1,
            approverId: step.stepType === ApprovalStepType.MANAGER
              ? (step.assignedUserId ?? profile.managerId)
              : step.assignedUserId,
          })),
        },
      },
      include: { lineItems: true, approvalSteps: true },
    });

    return NextResponse.json({ requisition: updated });
  } catch (e: any) {
    console.error("[requisitions submit]", e?.message);
    return NextResponse.json({ error: e?.message ?? "Failed to submit requisition" }, { status: 500 });
  }
}
