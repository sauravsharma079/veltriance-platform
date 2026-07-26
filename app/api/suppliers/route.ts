import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ suppliers: [] });
    const organization = await getCurrentOrganization();
    if (!organization) return NextResponse.json({ suppliers: [] });

    const q = req.nextUrl.searchParams.get("q") ?? "";
    const status = req.nextUrl.searchParams.get("status");
    const preferredOnly = req.nextUrl.searchParams.get("preferred") === "true";

    const suppliers = await prisma.supplier.findMany({
      where: {
        AND: [
          { organizationId: organization.id },
          q ? { OR: [
            { name: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
          ]} : {},
          status ? { status: status as any } : {},
          preferredOnly ? { preferred: true } : {},
        ],
      },
      orderBy: [{ preferred: "desc" }, { name: "asc" }],
      take: 100,
    });

    return NextResponse.json({ suppliers });
  } catch (e: any) {
    console.error("[suppliers GET]", e?.message);
    return NextResponse.json({ suppliers: [] });
  }
}

const newSupplierSchema = z.object({
  name: z.string().min(1),
  contactEmail: z.string().email().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  businessJustification: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organization = await getCurrentOrganization();
    if (!organization) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const profile = await prisma.user.findUnique({ where: { authId: user.id } });
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const body = await req.json();
    const parsed = newSupplierSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 });

    const d = parsed.data;
    const count = await prisma.supplier.count({ where: { organizationId: organization.id } });
    const code = `SUP-${String(count + 101).padStart(3, "0")}`;

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: organization.id,
        name: d.name,
        code,
        status: "PENDING_APPROVAL",
        onboardingStage: "REGISTRATION",
        contactEmail: d.contactEmail,
        contactName: d.contactName,
        contactPhone: d.contactPhone,
        category: d.category,
        paymentTerms: d.paymentTerms,
        city: d.city,
        country: d.country ?? "India",
        currency: "INR",
        requestedById: profile.id,
      },
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (e: any) {
    console.error("[suppliers POST]", e?.message);
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
