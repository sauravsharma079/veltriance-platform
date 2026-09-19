import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getMemberOrganization } from "@/lib/tenant";
export async function GET(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ requisitions: [] });
    const org = await getMemberOrganization(user.id);
    if (!org) return NextResponse.json({ requisitions: [] });
    // Same rule as /api/requisitions: only PROCUREMENT and ADMIN see the whole org.
    const profile = await prisma.user.findUnique({ where: { authId: user.id }, select: { id: true, role: true } });
    if (!profile) return NextResponse.json({ requisitions: [] });
    const seesAll = profile.role === "PROCUREMENT" || profile.role === "ADMIN";
    const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("limit") ?? "200") || 200, 1), 500);
    const requisitions = await prisma.requisition.findMany({
      where: seesAll ? { organizationId: org.id } : { organizationId: org.id, requestorId: profile.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { requestor: { select: { name: true, email: true } } },
    });
    return NextResponse.json({ requisitions });
  } catch (e: any) {
    console.error("[admin/requisitions]", e?.message);
    return NextResponse.json({ requisitions: [] });
  }
}
