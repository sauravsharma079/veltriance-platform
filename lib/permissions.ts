import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Checks the permission matrix built by Admin -> Roles (WorkspaceRole.permissions,
// a { [module]: { [action]: boolean } } blob edited via PermMatrix in
// app/dashboard/admin/page.tsx) across every WorkspaceRole assigned to this user.
export async function userHasPermission(userId: string, module: string, action: string): Promise<boolean> {
  const memberships = await prisma.workspaceRoleMember.findMany({
    where: { userId },
    select: { role: { select: { permissions: true } } },
  });
  return memberships.some(m => {
    const perms = m.role.permissions as Record<string, Record<string, boolean>> | null;
    return perms?.[module]?.[action] === true;
  });
}

/**
 * Who can edit a given supplier record: ADMIN/PROCUREMENT always can (they
 * already own supplier management elsewhere in the app), the specific user
 * assigned to that supplier can, and anyone granted the "suppliers.edit"
 * permission via a WorkspaceRole can.
 */
export async function canEditSupplier(
  profile: { id: string; role: string },
  supplier: { assignedUserId: string | null }
): Promise<boolean> {
  if (profile.role === "ADMIN" || profile.role === "PROCUREMENT") return true;
  if (supplier.assignedUserId && supplier.assignedUserId === profile.id) return true;
  return userHasPermission(profile.id, "suppliers", "edit");
}

/**
 * Extra PurchaseOrder filter for who may see which POs. REQUESTORs only see POs
 * they created or that came from their own requisitions (mirrors how
 * /api/requisitions scopes them); APPROVER, PROCUREMENT and ADMIN see the org.
 */
export async function purchaseOrderScope(authId: string, organizationId: string): Promise<Prisma.PurchaseOrderWhereInput | null> {
  const profile = await prisma.user.findFirst({ where: { authId, organizationId }, select: { id: true, role: true } });
  if (!profile) return null;
  if (profile.role !== "REQUESTOR") return {};
  return { OR: [{ createdById: profile.id }, { requisition: { requestorId: profile.id } }] };
}
