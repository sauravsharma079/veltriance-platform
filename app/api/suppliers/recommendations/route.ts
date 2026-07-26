import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") ?? "";
  const organization = await getCurrentOrganization();
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
