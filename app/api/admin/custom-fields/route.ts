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
    if (!ctx) return NextResponse.json({ fields: [] });
    const fields = await prisma.customField.findMany({
      where: { organizationId: ctx.org.id },
      orderBy: [{ module: 'asc' }, { sortOrder: 'asc' }],
    });
    return NextResponse.json({ fields });
  } catch { return NextResponse.json({ fields: [] }); }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCtx();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const count = await prisma.customField.count({ where: { organizationId: ctx.org.id, module: body.module } });
    const field = await prisma.customField.create({
      data: {
        organizationId: ctx.org.id,
        module: body.module, fieldName: body.fieldName,
        label: body.label, fieldType: body.fieldType,
        required: body.required ?? false,
        sortOrder: count + 1,
        placeholder: body.placeholder || null,
        options: body.options || [],
      },
    });
    return NextResponse.json({ field }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await getCtx();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await req.json();
    await prisma.customField.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
