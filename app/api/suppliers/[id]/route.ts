import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const supplier = await prisma.supplier.findFirst({ where: { id, organizationId: org.id }, include: { contacts: true } });
    if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ supplier });
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await req.json();
    const supplier = await prisma.supplier.update({ where: { id, organizationId: org.id }, data: body });
    return NextResponse.json({ supplier });
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}
