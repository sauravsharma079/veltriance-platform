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
  const group = await prisma.contentGroup.findUnique({ where: { id } });
  if (!group || group.organizationId !== ctx.organization.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  if (body.addUserId) {
    await prisma.contentGroupMember.upsert({
      where: { contentGroupId_userId: { contentGroupId: id, userId: body.addUserId } },
      create: { contentGroupId: id, userId: body.addUserId },
      update: {},
    });
    return NextResponse.json({ success: true });
  }
  if (body.removeUserId) {
    await prisma.contentGroupMember.deleteMany({ where: { contentGroupId: id, userId: body.removeUserId } });
    return NextResponse.json({ success: true });
  }
  const updated = await prisma.contentGroup.update({ where: { id }, data: { name: body.name, description: body.description, color: body.color } });
  return NextResponse.json({ group: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const group = await prisma.contentGroup.findUnique({ where: { id } });
  if (!group || group.organizationId !== ctx.organization.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.contentGroup.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
