import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [profile, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !organization || profile.organizationId !== organization.id) return null;
  if (profile.role !== "ADMIN") return null;
  return { profile, organization };
}

const patchSchema = z.object({
  role: z.enum(["REQUESTOR", "APPROVER", "PROCUREMENT", "ADMIN"]).optional(),
  department: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  employeeId: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  // Assignment operations
  addWorkspaceRoleId: z.string().optional(),
  removeWorkspaceRoleId: z.string().optional(),
  addContentGroupId: z.string().optional(),
  removeContentGroupId: z.string().optional(),
  addCoaId: z.string().optional(),
  removeCoaId: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.organizationId !== ctx.organization.id)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const d = parsed.data;

  // Role / profile field update
  const profileUpdate: Record<string, unknown> = {};
  if (d.role !== undefined) profileUpdate.role = d.role;
  if (d.department !== undefined) profileUpdate.department = d.department;
  if (d.phone !== undefined) profileUpdate.phone = d.phone;
  if (d.employeeId !== undefined) profileUpdate.employeeId = d.employeeId;
  if (d.jobTitle !== undefined) profileUpdate.jobTitle = d.jobTitle;
  if (Object.keys(profileUpdate).length > 0) {
    await prisma.user.update({ where: { id }, data: profileUpdate });
  }

  // Workspace role assignments
  if (d.addWorkspaceRoleId) {
    await prisma.workspaceRoleMember.upsert({
      where: { userId_roleId: { userId: id, roleId: d.addWorkspaceRoleId } },
      create: { userId: id, roleId: d.addWorkspaceRoleId },
      update: {},
    });
  }
  if (d.removeWorkspaceRoleId) {
    await prisma.workspaceRoleMember.deleteMany({ where: { userId: id, roleId: d.removeWorkspaceRoleId } });
  }

  // Content group assignments
  if (d.addContentGroupId) {
    await prisma.contentGroupMember.upsert({
      where: { contentGroupId_userId: { contentGroupId: d.addContentGroupId, userId: id } },
      create: { contentGroupId: d.addContentGroupId, userId: id },
      update: {},
    });
  }
  if (d.removeContentGroupId) {
    await prisma.contentGroupMember.deleteMany({ where: { contentGroupId: d.removeContentGroupId, userId: id } });
  }

  // COA access assignments
  if (d.addCoaId) {
    await prisma.userChartOfAccount.upsert({
      where: { userId_chartOfAccountId: { userId: id, chartOfAccountId: d.addCoaId } },
      create: { userId: id, chartOfAccountId: d.addCoaId },
      update: {},
    });
  }
  if (d.removeCoaId) {
    await prisma.userChartOfAccount.deleteMany({ where: { userId: id, chartOfAccountId: d.removeCoaId } });
  }

  return NextResponse.json({ success: true });
}
