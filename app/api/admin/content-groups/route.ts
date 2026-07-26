import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

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
