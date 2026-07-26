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

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const entity = req.nextUrl.searchParams.get("entity");
  const fields = await prisma.customField.findMany({
    where: {
      organizationId: ctx.organization.id,
      ...(entity ? { entity: entity as never } : {}),
    },
    orderBy: [{ entity: "asc" }, { sortOrder: "asc" }],
  });
  return NextResponse.json({ fields });
}

const fieldSchema = z.object({
  entity: z.enum(["REQUISITION", "SUPPLIER", "PURCHASE_ORDER"]),
  name: z.string().min(1),
  fieldKey: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, "Must be lowercase letters, numbers, underscores"),
  fieldType: z.enum(["TEXT", "NUMBER", "DATE", "DROPDOWN", "CHECKBOX", "TEXTAREA"]),
  required: z.boolean().default(false),
  options: z.array(z.string()).default([]),
  helpText: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = fieldSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const field = await prisma.customField.create({
    data: { ...parsed.data, organizationId: ctx.organization.id },
  });
  return NextResponse.json({ field }, { status: 201 });
}
