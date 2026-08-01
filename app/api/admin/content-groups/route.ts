import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { requireAdmin } from "@/lib/api-auth";

export async function GET() {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ groups: [] });
    const [profile, org] = await Promise.all([
      prisma.user.findUnique({ where: { authId: user.id } }),
      getCurrentOrganization(),
    ]);
    if (!profile || !org) return NextResponse.json({ groups: [] });
    const groups = await prisma.contentGroup.findMany({
      where: { organizationId: org.id }, orderBy: { name: 'asc' },
    });
    return NextResponse.json({ groups });
  } catch { return NextResponse.json({ groups: [] }); }
}

// Was missing entirely, same as roles/route.ts — AdminAgent's "Create content group"
// flow always hit a 405 since only [id]/route.ts (edit/delete) existed.
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json();
    if (!body.name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
    const group = await prisma.contentGroup.create({
      data: {
        organizationId: admin.organizationId,
        name: body.name.trim(),
        description: body.description || null,
        color: body.color || "#1A2A52",
      },
    });
    return NextResponse.json({ group }, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "A content group with this name already exists" }, { status: 409 });
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
