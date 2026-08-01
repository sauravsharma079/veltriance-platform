import { ApprovalStepType, RequisitionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Single source of truth for "which requisition status does landing on this step type put us in?" */
export const STATUS_FOR_STEP: Record<ApprovalStepType, RequisitionStatus> = {
  [ApprovalStepType.MANAGER]: RequisitionStatus.MANAGER_APPROVAL,
  [ApprovalStepType.DIRECTOR]: RequisitionStatus.DIRECTOR_APPROVAL,
  [ApprovalStepType.PROCUREMENT]: RequisitionStatus.PROCUREMENT_REVIEW,
  [ApprovalStepType.FINANCE]: RequisitionStatus.FINANCE_APPROVAL,
  [ApprovalStepType.CUSTOM]: RequisitionStatus.PROCUREMENT_REVIEW,
};

export type ApprovalStepDef = {
  stepType: ApprovalStepType;
  stepLabel: string | null;
  sequence: number;
  assignedUserId: string | null;
  approverUserIds: string[];
  approverMode: "ANY" | "ALL";
};

/**
 * Resolves the approval chain for a requisition by checking the org's
 * configurable ApprovalRules in priority order.
 *
 * Rules are evaluated in ascending priority order; the first rule whose
 * conditions ALL match is used. If no rule matches, we fall back to the
 * hardcoded defaults so the system never silently swallows a requisition.
 *
 * HARDCODED FALLBACK (shown when no rules exist yet):
 *   < $5,000   → Manager
 *   $5k–$25k   → Manager + Director
 *   ≥ $25,000  → Procurement + Finance
 */
export async function resolveApprovalSteps(
  organizationId: string,
  amount: number,
  category?: string | null,
  department?: string | null
): Promise<ApprovalStepDef[]> {
  const rules = await prisma.approvalRule.findMany({
    where: { organizationId, active: true },
    include: { steps: { orderBy: { sequence: "asc" } } },
    orderBy: { priority: "asc" },
  });

  for (const rule of rules) {
    const amountOk =
      (rule.minAmount === null || amount >= Number(rule.minAmount)) &&
      (rule.maxAmount === null || amount <= Number(rule.maxAmount));
    const categoryOk = rule.category === null || rule.category === category;
    const deptOk = rule.department === null || rule.department === department;

    if (amountOk && categoryOk && deptOk) {
      return rule.steps.map((s, i) => ({
        stepType: s.stepType,
        stepLabel: s.stepLabel,
        sequence: i + 1,
        assignedUserId: s.assignedUserId,
        approverUserIds: s.approverUserIds,
        approverMode: (s.approverMode === "ALL" ? "ALL" : "ANY") as "ANY" | "ALL",
      }));
    }
  }

  // ── Hardcoded fallback (used when no rules are configured) ──────────────
  return getHardcodedSteps(amount);
}

function getHardcodedSteps(amount: number): ApprovalStepDef[] {
  if (amount < 5000) {
    return [{ stepType: ApprovalStepType.MANAGER, stepLabel: null, sequence: 1, assignedUserId: null, approverUserIds: [], approverMode: "ANY" }];
  }
  if (amount < 25000) {
    return [
      { stepType: ApprovalStepType.MANAGER, stepLabel: null, sequence: 1, assignedUserId: null, approverUserIds: [], approverMode: "ANY" },
      { stepType: ApprovalStepType.DIRECTOR, stepLabel: null, sequence: 2, assignedUserId: null, approverUserIds: [], approverMode: "ANY" },
    ];
  }
  return [
    { stepType: ApprovalStepType.PROCUREMENT, stepLabel: null, sequence: 1, assignedUserId: null, approverUserIds: [], approverMode: "ANY" },
    { stepType: ApprovalStepType.FINANCE, stepLabel: null, sequence: 2, assignedUserId: null, approverUserIds: [], approverMode: "ANY" },
  ];
}

/** Single source of truth for "can this user act on this pending step?" */
export const ROLE_FOR_STEP: Record<ApprovalStepType, string | null> = {
  MANAGER: null,
  DIRECTOR: "PROCUREMENT",
  PROCUREMENT: "PROCUREMENT",
  FINANCE: "ADMIN",
  CUSTOM: "ADMIN",
};

export function canActOnStep(
  step: { stepType: ApprovalStepType; approverId: string | null },
  user: { id: string; role: string }
): boolean {
  // Admins can always act on any step
  if (user.role === "ADMIN") return true;

  // Assigned approver can always act
  if (step.approverId && step.approverId === user.id) return true;

  // For unassigned manager steps, anyone with APPROVER, PROCUREMENT or ADMIN role can act
  if (step.stepType === ApprovalStepType.MANAGER && !step.approverId) {
    return user.role === "APPROVER" || user.role === "PROCUREMENT";
  }

  // For other step types, check the required role
  const requiredRole = ROLE_FOR_STEP[step.stepType];
  if (!requiredRole) return false;
  return user.role === requiredRole;
}
