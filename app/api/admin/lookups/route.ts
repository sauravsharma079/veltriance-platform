import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

async function getOrgAndProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [profile, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !organization || profile.organizationId !== organization.id) return null;
  return { profile, organization };
}

// GET — any authenticated user can read lookups (needed for intake forms)
export async function GET(req: NextRequest) {
  const ctx = await getOrgAndProfile();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = req.nextUrl.searchParams.get("type");
  const [lookups, coaSegments, coas] = await Promise.all([
    prisma.lookup.findMany({
      where: {
        organizationId: ctx.organization.id,
        active: true,
        ...(type ? { type } : {}),
      },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    }),
    prisma.coaSegment.findMany({
      where: { chartOfAccount: { organizationId: ctx.organization.id } },
      include: { chartOfAccount: { select: { name: true, code: true } } },
      orderBy: [{ chartOfAccountId: "asc" }, { position: "asc" }],
    }),
    prisma.chartOfAccount.findMany({
      where: { organizationId: ctx.organization.id, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({ lookups, coaSegments, coas });
}

const lookupSchema = z.object({
  type: z.string().min(1),
  code: z.string().min(1),
  label: z.string().min(1),
  parentCode: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  coaId: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await getOrgAndProfile();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = lookupSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const lookup = await prisma.lookup.create({
    data: { ...parsed.data, organizationId: ctx.organization.id },
  });
  return NextResponse.json({ lookup }, { status: 201 });
}
