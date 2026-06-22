import { ApprovalStepType } from "@prisma/client";

/**
 * Amount-based approval routing, per the MVP spec:
 *   $0      – $5,000   → Manager
 *   $5,000  – $25,000  → Manager + Director
 *   $25,000+           → Procurement + Finance
 *
 * This is intentionally a simple, hardcoded matrix for the MVP. The full
 * spec calls for a no-code configurable matrix in the Admin module — that's
 * a future sprint. When you build it, this function is the one place to
 * swap for a database-driven lookup.
 */
export function getApprovalSteps(amount: number): ApprovalStepType[] {
  if (amount < 5000) return [ApprovalStepType.MANAGER];
  if (amount < 25000) return [ApprovalStepType.MANAGER, ApprovalStepType.DIRECTOR];
  return [ApprovalStepType.PROCUREMENT, ApprovalStepType.FINANCE];
}

/**
 * Which app role is allowed to act on each step type when no specific
 * approver is pre-assigned. MANAGER steps are tied to a specific person
 * (the requestor's manager) and can't be "claimed" by role alone.
 */
export const ROLE_FOR_STEP: Record<ApprovalStepType, string | null> = {
  MANAGER: null,
  DIRECTOR: "PROCUREMENT", // MVP simplification — see README for the real-world caveat
  PROCUREMENT: "PROCUREMENT",
  FINANCE: "ADMIN",
};

/** Single source of truth for "can this user act on this pending step?" — used by both the approve API and the detail page so the UI never offers an action the server would reject. */
export function canActOnStep(
  step: { stepType: ApprovalStepType; approverId: string | null },
  user: { id: string; role: string }
): boolean {
  if (step.approverId === user.id) return true;
  const requiredRole = ROLE_FOR_STEP[step.stepType];
  if (!requiredRole) return false;
  return user.role === requiredRole || user.role === "ADMIN";
}
