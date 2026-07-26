import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
export async function GET() {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ clients: [] });
    const [profile, org] = await Promise.all([prisma.user.findUnique({ where: { authId: user.id } }), getCurrentOrganization()]);
    if (!profile || !org) return NextResponse.json({ clients: [] });
    const clients = await prisma.apiClient.findMany({ where: { organizationId: org.id }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ clients });
  } catch { return NextResponse.json({ clients: [] }); }
}
