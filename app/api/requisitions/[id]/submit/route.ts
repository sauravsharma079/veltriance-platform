import { NextRequest, NextResponse } from "next/server";
import { ApprovalStepType, RequisitionStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { moduleGuard } from "@/lib/licensing";
import { logAudit } from "@/lib/audit";
import { notifyCurrentApprovers } from "@/lib/approval-notify";
import { routeApproved } from "@/lib/requisition-approval";
import { getCurrentOrganization } from "@/lib/tenant";
import { STATUS_FOR_STEP } from "@/lib/approval-matrix";
import { planRequisition } from "@/lib/orchestrator";
import { errorMessage } from "@/lib/errors";

/**
 * POST /api/requisitions/[id]/submit
 *
 * Moves an existing DRAFT requisition into the approval chain — needed for
 * requisitions created outside the one-shot intake flow (e.g. a punchout
 * cart, which lands in DRAFT deliberately so the requestor can review
 * supplier-returned line items before they enter approval).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

    { const blocked = moduleGuard(organization, "INTAKE_TO_PO"); if (blocked) return blocked; }
    const requisition = await prisma.requisition.findUnique({ where: { id } });
    if (!requisition || requisition.organizationId !== organization.id)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (requisition.status !== "DRAFT")
      return NextResponse.json({ error: "Only draft requisitions can be submitted" }, { status: 422 });

    const isOwner = requisition.requestorId === profile.id;
    const canSubmitOnBehalf = profile.role === "PROCUREMENT" || profile.role === "ADMIN";
    if (!isOwner && !canSubmitOnBehalf)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const lines = await prisma.requisitionLineItem.findMany({ where: { requisitionId: id }, select: { supplierId: true } });
    const plan = await planRequisition({
      organizationId: organization.id, requestorId: requisition.requestorId, amount: Number(requisition.totalAmount), currency: requisition.currency,
      category: requisition.category, department: requisition.department, costCenter: requisition.costCenter, requisitionId: id,
      supplierIds: [...new Set(lines.map(l => l.supplierId).filter((x): x is string => !!x))],
    });
    if (plan.decision.blocked) return NextResponse.json({ error: plan.decision.blocked, code: "BUDGET_BLOCKED" }, { status: 422 });
    const approvalSteps = plan.decision.steps;
    const newStatus = approvalSteps.length > 0
      ? STATUS_FOR_STEP[approvalSteps[0].stepType]
      : RequisitionStatus.APPROVED;

    const updated = await prisma.requisition.update({
      where: { id },
      data: {
        status: newStatus,
        submittedAt: new Date(),
        requireSourcing: plan.decision.requireSourcing,
        ...(plan.policyException && { policyException: true, policyExceptionNote: [requisition.policyExceptionNote, plan.policyExceptionNote].filter(Boolean).join(" ") }),
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

    await logAudit({
      organizationId: organization.id, userId: profile.id, userName: profile.name,
      action: "SUBMITTED", entity: "REQUISITION", entityId: id, entityLabel: requisition.requisitionNumber,
      details: { status: updated.status },
    });

    // Tell the approvers straight away — or, if a rule approved it outright, raise the PO now.
    if (approvalSteps.length > 0) await notifyCurrentApprovers({ requisitionId: id, origin: req.nextUrl.origin }).catch(e => console.error("[submit] approver notification failed:", e));
    else {
      await logAudit({ organizationId: organization.id, userName: "Policy engine", action: "APPROVED", entity: "REQUISITION", entityId: id, entityLabel: requisition.requisitionNumber, details: { auto: true, reason: plan.decision.notes[0] } });
      await routeApproved({ requisitionId: id, organizationId: organization.id, actor: { id: profile.id, name: profile.name, role: profile.role } }).catch(e => console.error("[submit] routing failed:", e));
    }

    return NextResponse.json({ requisition: updated, policy: { autoApproved: plan.decision.autoApproved, requireSourcing: plan.decision.requireSourcing, flags: plan.decision.flags, notes: plan.decision.notes } });
  } catch (e) {
    console.error("[requisitions submit]", errorMessage(e));
    return NextResponse.json({ error: errorMessage(e, "Failed to submit requisition") }, { status: 500 });
  }
}
