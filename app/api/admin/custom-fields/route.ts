import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CustomFieldEntity } from "@prisma/client";
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

// GET /api/admin/custom-fields
//   ?entity=REQUISITION                          -> admin listing, all fields for that entity
//   ?entity=REQUISITION&category=IT+Hardware&active=true
//                                                 -> live intake usage: active fields scoped to
//                                                    this category OR globally-applicable (categories: [])
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ fields: [] });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ fields: [] });

    const entityParam = req.nextUrl.searchParams.get("entity");
    const entity = entityParam && entityParam in CustomFieldEntity ? (entityParam as CustomFieldEntity) : null;
    const category = req.nextUrl.searchParams.get("category");
    const activeOnly = req.nextUrl.searchParams.get("active") === "true";

    const fields = await prisma.customField.findMany({
      where: {
        organizationId: org.id,
        ...(entity ? { entity } : {}),
        ...(activeOnly ? { active: true } : {}),
        ...(category
          ? { OR: [{ categories: { isEmpty: true } }, { categories: { has: category } }] }
          : {}),
      },
      orderBy: [{ entity: "asc" }, { sortOrder: "asc" }],
    });
    return NextResponse.json({ fields });
  } catch { return NextResponse.json({ fields: [] }); }
}

const createSchema = z.object({
  entity: z.enum(["REQUISITION", "SUPPLIER", "PURCHASE_ORDER"]),
  name: z.string().min(1),
  fieldKey: z.string().min(1).optional(),
  fieldType: z.enum(["TEXT", "NUMBER", "DATE", "DROPDOWN", "CHECKBOX", "TEXTAREA"]),
  required: z.boolean().default(false),
  options: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  conditions: z.record(z.string(), z.array(z.string())).optional(),
  helpText: z.string().optional(),
});

function zodErrorMessage(err: z.ZodError): string {
  const flat = err.flatten();
  const fieldParts = Object.entries(flat.fieldErrors).map(([k, v]) => `${k}: ${(v as string[] | undefined)?.[0]}`);
  return [...flat.formErrors, ...fieldParts].join(", ") || "Validation failed";
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAdmin();
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 422 });
    const d = parsed.data;
    const fieldKey = (d.fieldKey ?? d.name).toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

    const count = await prisma.customField.count({ where: { organizationId: ctx.organization.id, entity: d.entity } });
    const field = await prisma.customField.create({
      data: {
        organizationId: ctx.organization.id,
        entity: d.entity,
        name: d.name,
        fieldKey,
        fieldType: d.fieldType,
        required: d.required,
        options: d.options,
        categories: d.categories,
        conditions: d.conditions ?? undefined,
        helpText: d.helpText,
        sortOrder: count + 1,
      },
    });
    return NextResponse.json({ field }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await requireAdmin();
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await req.json();
    const existing = await prisma.customField.findUnique({ where: { id } });
    if (!existing || existing.organizationId !== ctx.organization.id)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.customField.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
