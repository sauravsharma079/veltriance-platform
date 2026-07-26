import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
export async function GET(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ suppliers: [] });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ suppliers: [] });
    const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "200");
    const suppliers = await prisma.supplier.findMany({
      where: { organizationId: org.id },
      orderBy: [{ preferred: "desc" }, { name: "asc" }],
      take: limit,
    });
    return NextResponse.json({ suppliers });
  } catch (e: any) {
    console.error("[admin/suppliers]", e?.message);
    return NextResponse.json({ suppliers: [] });
  }
}
