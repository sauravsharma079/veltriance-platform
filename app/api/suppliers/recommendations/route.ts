import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getMemberOrganization } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") ?? "";
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ suppliers: [] });
  const organization = await getMemberOrganization(user.id);
  if (!organization) return NextResponse.json({ suppliers: [] });

  const suppliers = await prisma.supplier.findMany({
    where: {
      organizationId: organization.id,
      status: "ACTIVE",
      ...(category ? { category: { contains: category, mode: "insensitive" } } : {}),
    },
    orderBy: [{ preferred: "desc" }, { rating: "desc" }, { name: "asc" }],
    select: { id: true, name: true, category: true, rating: true, preferred: true, riskLevel: true, contactEmail: true },
    take: 5,
  });

  return NextResponse.json({ suppliers });
}
