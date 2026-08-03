import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { resolveReadActor, parsePagination, pagMeta } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

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

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const auth = await resolveReadActor(req, "catalogs:read");
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const catalog = await prisma.catalog.findFirst({ where: { id, organizationId: auth.actor.organizationId } });
    if (!catalog) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { offset, limit } = parsePagination(req);
    const [items, total] = await Promise.all([
      prisma.catalogItem.findMany({
        where: { catalogId: id }, orderBy: { name: "asc" }, skip: offset, take: limit,
        include: { supplier: { select: { name: true } } },
      }),
      prisma.catalogItem.count({ where: { catalogId: id } }),
    ]);
    return NextResponse.json({ items, ...pagMeta(total, offset, limit, `/api/catalogs/${id}/items`) });
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}

const createItemSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  unitPrice: z.coerce.number().nonnegative(),
  currency: z.string().min(1),
  category: z.string().min(1),
  supplierId: z.string().min(1),
  unit: z.string().min(1),
  leadDays: z.coerce.number().int().nonnegative(),
  description: z.string().optional(),
});

function zodErrorMessage(err: z.ZodError): string {
  const flat = err.flatten();
  const fieldParts = Object.entries(flat.fieldErrors).map(([k, v]) => `${k}: ${(v as string[] | undefined)?.[0]}`);
  return [...flat.formErrors, ...fieldParts].join(", ") || "Validation failed";
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const adminCtx = await requireAdmin();
    if (!adminCtx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const catalog = await prisma.catalog.findFirst({ where: { id, organizationId: adminCtx.organization.id } });
    if (!catalog) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (catalog.type !== "HOSTED")
      return NextResponse.json({ error: "Items can only be added to hosted catalogs" }, { status: 422 });

    const body = await req.json();
    const parsed = createItemSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 422 });
    const d = parsed.data;

    const supplier = await prisma.supplier.findFirst({ where: { id: d.supplierId, organizationId: adminCtx.organization.id } });
    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 422 });

    const { sku, ...updateData } = d;
    const wasExisting = await prisma.catalogItem.findUnique({ where: { catalogId_sku: { catalogId: id, sku } }, select: { id: true } });
    const item = await prisma.catalogItem.upsert({
      where: { catalogId_sku: { catalogId: id, sku } },
      update: updateData,
      create: { catalogId: id, sku, ...updateData },
      include: { supplier: { select: { name: true } } },
    });
    await logAudit({
      organizationId: adminCtx.organization.id, userId: adminCtx.profile.id, userName: adminCtx.profile.name,
      action: wasExisting ? "UPDATED" : "CREATED", entity: "CATALOG", entityId: id, entityLabel: `${catalog.name} — ${item.name}`,
      details: { sku, catalogItemId: item.id },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}
