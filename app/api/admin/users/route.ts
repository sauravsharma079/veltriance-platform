import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);

  if (!profile || !organization || profile.organizationId !== organization.id) return null;
  if (profile.role !== "ADMIN") return null;
  return { profile, organization };
}

export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, department: true, createdAt: true },
  });
  return NextResponse.json({ users });
}
