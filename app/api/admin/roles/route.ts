import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { requireAdmin } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ roles: [] });
    const [profile, org] = await Promise.all([
      prisma.user.findUnique({ where: { authId: user.id } }),
      getCurrentOrganization(),
    ]);
    if (!profile || !org) return NextResponse.json({ roles: [] });
    const roles = await prisma.workspaceRole.findMany({
      where: { organizationId: org.id }, orderBy: { name: 'asc' },
      include: { userRoles: { include: { user: { select: { id: true, name: true } } } } },
    });
    return NextResponse.json({ roles });
  } catch { return NextResponse.json({ roles: [] }); }
}

// Was missing entirely — AdminAgent's "Create a role" chat flow (and the Roles
// admin UI's underlying create action) has been calling this since it was built,
// always getting a 405. Only PATCH/DELETE (in [id]/route.ts) existed.
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json();
    if (!body.name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
    const role = await prisma.workspaceRole.create({
      data: {
        organizationId: admin.organizationId,
        name: body.name.trim(),
        description: body.description || null,
        permissions: body.permissions ?? {},
        isSystem: false,
      },
    });
    await logAudit({
      organizationId: admin.organizationId, userId: admin.profile.id, userName: admin.profile.name,
      action: "CREATED", entity: "ROLE", entityId: role.id, entityLabel: role.name,
    });

    return NextResponse.json({ role }, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "A role with this name already exists" }, { status: 409 });
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
