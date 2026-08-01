import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const existing = await prisma.user.findFirst({ where: { id, organizationId: admin.organizationId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json();
  const user = await prisma.user.update({
    where: { id },
    data: {
      name: body.name,
      role: body.role,
      jobTitle: body.jobTitle,
      department: body.department,
      inviteStatus: body.inviteStatus,
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
