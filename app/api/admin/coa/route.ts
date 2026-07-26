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
  if (!profile || !organization || profile.organizationId !== organization.id || profile.role !== "ADMIN") return null;
  return { profile, organization };
}

// GET — all COAs with their segments and values
export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const coas = await prisma.chartOfAccount.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: { name: "asc" },
    include: {
      segments: {
        orderBy: { position: "asc" },
        include: { values: { where: { isActive: true }, orderBy: { code: "asc" } } },
      },
    },
  });

  return NextResponse.json({ coas });
}

const coaSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  companyCode: z.string().nullable().optional(),
  currency: z.string().default("INR"),
  description: z.string().nullable().optional(),
  billingContact: z.string().nullable().optional(),
  billingEmail: z.string().nullable().optional(),
  billingPhone: z.string().nullable().optional(),
  billingAddressLine1: z.string().nullable().optional(),
  billingAddressLine2: z.string().nullable().optional(),
  billingCity: z.string().nullable().optional(),
  billingState: z.string().nullable().optional(),
  billingPostal: z.string().nullable().optional(),
  billingCountry: z.string().nullable().optional(),
  taxRegNumber: z.string().nullable().optional(),
  taxType: z.string().nullable().optional(),
});

const segmentSchema = z.object({
  coaId: z.string(),
  position: z.coerce.number().min(1).max(5),
  name: z.string().min(1),
  description: z.string().optional(),
  isRequired: z.boolean().default(false),
  linkedLookupType: z.string().optional().nullable(),
});

const valueSchema = z.object({
  segmentId: z.string(),
  code: z.string().min(1),
  description: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  if (body.type === "coa") {
    const parsed = coaSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    try {
      const coa = await prisma.chartOfAccount.create({
        data: { ...parsed.data, organizationId: ctx.organization.id },
      });
      return NextResponse.json({ coa }, { status: 201 });
    } catch {
      return NextResponse.json({ error: "A COA with this code already exists." }, { status: 409 });
    }
  }

  if (body.type === "segment") {
    const parsed = segmentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    // Verify COA belongs to this org
    const coa = await prisma.chartOfAccount.findUnique({ where: { id: parsed.data.coaId } });
    if (!coa || coa.organizationId !== ctx.organization.id) return NextResponse.json({ error: "COA not found" }, { status: 404 });
    const segment = await prisma.coaSegment.upsert({
      where: { chartOfAccountId_position: { chartOfAccountId: parsed.data.coaId, position: parsed.data.position } },
      update: { name: parsed.data.name, description: parsed.data.description, isRequired: parsed.data.isRequired, linkedLookupType: parsed.data.linkedLookupType ?? null },
      create: { chartOfAccountId: parsed.data.coaId, position: parsed.data.position, name: parsed.data.name, description: parsed.data.description, isRequired: parsed.data.isRequired, linkedLookupType: parsed.data.linkedLookupType ?? null },
    });
    return NextResponse.json({ segment }, { status: 201 });
  }

  if (body.type === "value") {
    const parsed = valueSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    try {
      const value = await prisma.coaSegmentValue.create({
        data: { segmentId: parsed.data.segmentId, code: parsed.data.code, description: parsed.data.description },
      });
      return NextResponse.json({ value }, { status: 201 });
    } catch {
      return NextResponse.json({ error: "A value with this code already exists in this segment." }, { status: 409 });
    }
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
