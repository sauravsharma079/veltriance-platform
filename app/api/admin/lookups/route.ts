import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { requireAdmin } from "@/lib/api-auth";
export async function GET(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ lookups: [] });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ lookups: [] });
    const type = req.nextUrl.searchParams.get("type");
    const lookups = await prisma.lookup.findMany({
      where: { organizationId: org.id, active: true, ...(type ? { type } : {}) },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
    });
    return NextResponse.json({ lookups });
  } catch { return NextResponse.json({ lookups: [] }); }
}
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { type, code, label, parentCode } = await req.json();
    if (!type || !code || !label) return NextResponse.json({ error: "type, code, label required" }, { status: 400 });
    const count = await prisma.lookup.count({ where: { organizationId: admin.organizationId, type } });
    const lookup = await prisma.lookup.create({ data: { organizationId: admin.organizationId, type, code: code.toUpperCase(), label, parentCode: parentCode || null, sortOrder: count + 1, active: true } });
    return NextResponse.json({ lookup }, { status: 201 });
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}
export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await req.json();
    await prisma.lookup.delete({ where: { id, organizationId: admin.organizationId } });
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}
