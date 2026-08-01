import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

// AdminAgent's edit flow (and now the manual Users UI) has been sending
// addWorkspaceRoleId/removeWorkspaceRoleId, addContentGroupId/removeContentGroupId,
// and addCoaId/removeCoaId to this route since it was built — none of that was ever
// handled here, so it silently no-op'd (Prisma ignores unrecognized keys in `data`,
// so the update still "succeeded" with nothing actually changing).
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const existing = await prisma.user.findFirst({ where: { id, organizationId: admin.organizationId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json();

  if (body.addWorkspaceRoleId) {
    const role = await prisma.workspaceRole.findFirst({ where: { id: body.addWorkspaceRoleId, organizationId: admin.organizationId } });
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    await prisma.workspaceRoleMember.upsert({
      where: { userId_roleId: { userId: id, roleId: body.addWorkspaceRoleId } },
      create: { userId: id, roleId: body.addWorkspaceRoleId },
      update: {},
    });
    return NextResponse.json({ success: true });
  }
  if (body.removeWorkspaceRoleId) {
    await prisma.workspaceRoleMember.deleteMany({ where: { userId: id, roleId: body.removeWorkspaceRoleId } });
    return NextResponse.json({ success: true });
  }
  if (body.addContentGroupId) {
    const group = await prisma.contentGroup.findFirst({ where: { id: body.addContentGroupId, organizationId: admin.organizationId } });
    if (!group) return NextResponse.json({ error: "Content group not found" }, { status: 404 });
    await prisma.contentGroupMember.upsert({
      where: { contentGroupId_userId: { contentGroupId: body.addContentGroupId, userId: id } },
      create: { contentGroupId: body.addContentGroupId, userId: id },
      update: {},
    });
    return NextResponse.json({ success: true });
  }
  if (body.removeContentGroupId) {
    await prisma.contentGroupMember.deleteMany({ where: { contentGroupId: body.removeContentGroupId, userId: id } });
    return NextResponse.json({ success: true });
  }
  if (body.addCoaId) {
    const coa = await prisma.chartOfAccount.findFirst({ where: { id: body.addCoaId, organizationId: admin.organizationId } });
    if (!coa) return NextResponse.json({ error: "Chart of accounts not found" }, { status: 404 });
    await prisma.userChartOfAccount.upsert({
      where: { userId_chartOfAccountId: { userId: id, chartOfAccountId: body.addCoaId } },
      create: { userId: id, chartOfAccountId: body.addCoaId },
      update: {},
    });
    return NextResponse.json({ success: true });
  }
  if (body.removeCoaId) {
    await prisma.userChartOfAccount.deleteMany({ where: { userId: id, chartOfAccountId: body.removeCoaId } });
    return NextResponse.json({ success: true });
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      name: body.name,
      role: body.role,
      jobTitle: body.jobTitle,
      department: body.department,
      inviteStatus: body.inviteStatus,
      employeeId: body.employeeId,
      managerId: body.managerId || null,
      businessUnit: body.businessUnit,
      costCenter: body.costCenter,
      addressLine1: body.addressLine1,
      addressLine2: body.addressLine2,
      city: body.city,
      state: body.state,
      postalCode: body.postalCode,
      country: body.country,
    },
  });
  return NextResponse.json({ user });
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const existing = await prisma.user.findFirst({ where: { id, organizationId: admin.organizationId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (id === admin.profile.id) return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
