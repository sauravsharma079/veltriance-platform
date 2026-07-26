import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [profile, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !organization || profile.role !== "ADMIN" || profile.organizationId !== organization.id) return null;
  return { profile, organization };
}

export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const roles = await prisma.workspaceRole.findMany({
    where: { organizationId: ctx.organization.id },
    include: {
      userRoles: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ roles });
}

const roleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  permissions: z.record(z.any()).default({}),
});

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const parsed = roleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  try {
    const role = await prisma.workspaceRole.create({
      data: { ...parsed.data, organizationId: ctx.organization.id },
    });
    return NextResponse.json({ role }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A role with this name already exists." }, { status: 409 });
  }
}
