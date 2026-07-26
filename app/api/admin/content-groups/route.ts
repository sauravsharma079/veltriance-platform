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
  const groups = await prisma.contentGroup.findMany({
    where: { organizationId: ctx.organization.id },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ groups });
}

const groupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const parsed = groupSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  try {
    const group = await prisma.contentGroup.create({
      data: { ...parsed.data, organizationId: ctx.organization.id },
    });
    return NextResponse.json({ group }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A group with this name already exists." }, { status: 409 });
  }
}
