import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

async function requireAdmin(organization: Awaited<ReturnType<typeof getCurrentOrganization>>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const profile = await prisma.user.findUnique({ where: { authId: user.id } });
  return profile?.role === "ADMIN" && profile.organizationId === organization?.id;
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organization = await getCurrentOrganization();
  if (!await requireAdmin(organization)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const coa = await prisma.chartOfAccount.findUnique({ where: { id } });
  if (!coa || coa.organizationId !== organization?.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.chartOfAccount.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organization = await getCurrentOrganization();
  if (!await requireAdmin(organization)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  // PATCH on a COA: toggle isActive
  if (body.isActive !== undefined) {
    const coa = await prisma.chartOfAccount.findUnique({ where: { id } });
    if (!coa || coa.organizationId !== organization?.id)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    const updated = await prisma.chartOfAccount.update({ where: { id }, data: { isActive: body.isActive } });
    return NextResponse.json({ coa: updated });
  }

  // PATCH on a CoaSegment: update linkedLookupType (called from Lookups tab)
  if (body.segmentId !== undefined) {
    const segment = await prisma.coaSegment.findUnique({
      where: { id: body.segmentId },
      include: { chartOfAccount: { select: { organizationId: true } } },
    });
    if (!segment || segment.chartOfAccount.organizationId !== organization?.id)
      return NextResponse.json({ error: "Segment not found" }, { status: 404 });

    const updated = await prisma.coaSegment.update({
      where: { id: body.segmentId },
      data: { linkedLookupType: body.linkedLookupType ?? null },
    });
    return NextResponse.json({ segment: updated });
  }

  return NextResponse.json({ error: "Unknown update" }, { status: 400 });
}
