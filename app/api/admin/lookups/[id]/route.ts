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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const lookup = await prisma.lookup.findUnique({ where: { id } });
  if (!lookup || lookup.organizationId !== ctx.organization.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.lookup.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const lookup = await prisma.lookup.findUnique({ where: { id } });
  if (!lookup || lookup.organizationId !== ctx.organization.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.lookup.update({
    where: { id },
    data: { coaId: body.coaId ?? null },
  });
  return NextResponse.json({ lookup: updated });
}
