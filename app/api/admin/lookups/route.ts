import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

async function getCtx() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const [profile, org] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !org) return null;
  return { profile, org };
}

export async function GET() {
  try {
    const ctx = await getCtx();
    if (!ctx) return NextResponse.json({ lookups: [] });
    const lookups = await prisma.lookup.findMany({
      where: { organizationId: ctx.org.id },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
    });
    return NextResponse.json({ lookups });
  } catch { return NextResponse.json({ lookups: [] }); }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCtx();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const count = await prisma.lookup.count({ where: { organizationId: ctx.org.id, type: body.type } });
    const lookup = await prisma.lookup.create({
      data: {
        organizationId: ctx.org.id,
        type: body.type, code: body.code,
        label: body.label, sortOrder: count + 1,
      },
    });
    return NextResponse.json({ lookup }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await getCtx();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await req.json();
    await prisma.lookup.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
