import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organization = await getCurrentOrganization();
  if (!organization) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: { requestedBy: { select: { name: true, email: true } } },
  });
  if (!supplier || supplier.organizationId !== organization.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ supplier });
}

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "PENDING_APPROVAL", "BLOCKED", "INACTIVE"]),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !organization || profile.organizationId !== organization.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (profile.role !== "PROCUREMENT" && profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden — procurement or admin role required" }, { status: 403 });
  }

  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== organization.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const supplier = await prisma.supplier.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ supplier });
}
