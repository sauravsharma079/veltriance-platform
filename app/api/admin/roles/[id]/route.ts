import { NextRequest, NextResponse } from "next/server";
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
  if (!profile || !organization || profile.role !== "ADMIN" || profile.organizationId !== organization.id) return null;
  return { profile, organization };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const role = await prisma.workspaceRole.findUnique({ where: { id } });
  if (!role || role.organizationId !== ctx.organization.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  // Handle assigning a user to this role
  if (body.addUserId) {
    await prisma.workspaceRoleMember.upsert({
      where: { userId_roleId: { userId: body.addUserId, roleId: id } },
      create: { userId: body.addUserId, roleId: id },
      update: {},
    });
    return NextResponse.json({ success: true });
  }
  if (body.removeUserId) {
    await prisma.workspaceRoleMember.deleteMany({ where: { userId: body.removeUserId, roleId: id } });
    return NextResponse.json({ success: true });
  }
  const updated = await prisma.workspaceRole.update({
    where: { id },
    data: { name: body.name, description: body.description, permissions: body.permissions },
  });
  return NextResponse.json({ role: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const role = await prisma.workspaceRole.findUnique({ where: { id } });
  if (!role || role.organizationId !== ctx.organization.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role.isSystem) return NextResponse.json({ error: "System roles cannot be deleted." }, { status: 400 });
  await prisma.workspaceRole.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
