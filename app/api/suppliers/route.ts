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
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const where: any = { organizationId: org.id };
    if (status) where.status = status;
    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { name: "asc" },
      take: 100,
    });
    return NextResponse.json({ suppliers });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ suppliers: [] });
  }
}
