import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const organization = await getCurrentOrganization();
  if (!organization) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const status = req.nextUrl.searchParams.get("status");
  const preferredOnly = req.nextUrl.searchParams.get("preferred") === "true";

  const suppliers = await prisma.supplier.findMany({
    where: {
      AND: [
        { organizationId: organization.id },
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { category: { contains: q, mode: "insensitive" } },
                { code: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        status ? { status: status as never } : {},
        preferredOnly ? { preferred: true } : {},
      ],
    },
    orderBy: [{ preferred: "desc" }, { name: "asc" }],
    take: 50,
  });

  return NextResponse.json({ suppliers });
}

const newSupplierSchema = z.object({
  name: z.string().min(1),
  contactEmail: z.string().email(),
  category: z.string().min(1),
  businessJustification: z.string().min(10),
});

export async function POST(req: NextRequest) {
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

  const body = await req.json();
  const parsed = newSupplierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const supplier = await prisma.supplier.create({
    data: {
      ...parsed.data,
      organizationId: organization.id,
      status: "PENDING_APPROVAL",
      requestedById: profile.id,
    },
  });

  return NextResponse.json({ supplier }, { status: 201 });
}
