import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
export async function GET(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ requisitions: [] });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ requisitions: [] });
    const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "200");
    const requisitions = await prisma.requisition.findMany({
      where: { organizationId: org.id },
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
