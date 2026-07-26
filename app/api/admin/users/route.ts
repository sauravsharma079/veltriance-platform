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
  if (!profile || !org || profile.organizationId !== org.id) return null;
  return { profile, org };
}

export async function GET() {
  try {
    const ctx = await getCtx();
    if (!ctx) return NextResponse.json({ users: [] });
    const users = await prisma.user.findMany({
      where: { organizationId: ctx.org.id },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ users });
  } catch { return NextResponse.json({ users: [] }); }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getCtx();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const user = await prisma.user.create({
      data: {
        organizationId: ctx.org.id,
        email: body.email, name: body.name,
        role: body.role || 'REQUESTOR',
        jobTitle: body.jobTitle || null,
        department: body.department || null,
        currency: 'INR', inviteStatus: 'PENDING',
      },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
