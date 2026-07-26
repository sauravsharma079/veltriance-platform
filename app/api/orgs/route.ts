import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Public endpoint — returns organisation name + slug only.
 * No auth required; no sensitive data is exposed.
 * Used by the root landing page workspace search.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ orgs: [] });
  }

  const orgs = await prisma.organization.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { name: true, slug: true },
    orderBy: { name: "asc" },
    take: 8,
  });

  return NextResponse.json({ orgs });
}
