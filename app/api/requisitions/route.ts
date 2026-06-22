import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !organization || profile.organizationId !== organization.id) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const scope = req.nextUrl.searchParams.get("scope") ?? "mine";

  const where =
    scope === "all" && (profile.role === "PROCUREMENT" || profile.role === "ADMIN")
      ? { organizationId: organization.id }
      : { organizationId: organization.id, requestorId: profile.id };

  const requisitions = await prisma.requisition.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { requestor: { select: { name: true } }, lineItems: true },
  });

  return NextResponse.json({ requisitions });
}
