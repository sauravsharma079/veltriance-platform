import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getMemberOrganization } from "@/lib/tenant";
import { errorMessage } from "@/lib/errors";
export async function GET(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ suppliers: [] });
    const org = await getMemberOrganization(user.id);
    if (!org) return NextResponse.json({ suppliers: [] });
    const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("limit") ?? "200") || 200, 1), 500);
    const suppliers = await prisma.supplier.findMany({
      where: { organizationId: org.id },
      orderBy: [{ preferred: "desc" }, { name: "asc" }],
      take: limit,
    });
    return NextResponse.json({ suppliers });
  } catch (e) {
    console.error("[admin/suppliers]", errorMessage(e));
    return NextResponse.json({ suppliers: [] });
  }
}
