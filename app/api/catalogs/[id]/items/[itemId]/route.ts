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

async function loadOwnedItem(id: string, itemId: string, organizationId: string) {
  const item = await prisma.catalogItem.findFirst({ where: { id: itemId, catalogId: id }, include: { catalog: true } });
  if (!item || item.catalog.organizationId !== organizationId) return null;
  return item;
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  unitPrice: z.coerce.number().nonnegative().optional(),
  currency: z.string().optional(),
  category: z.string().optional(),
  supplierId: z.string().optional(),
  unit: z.string().optional(),
  leadDays: z.coerce.number().int().nonnegative().optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
});

function zodErrorMessage(err: z.ZodError): string {
  const flat = err.flatten();
  const fieldParts = Object.entries(flat.fieldErrors).map(([k, v]) => `${k}: ${(v as string[] | undefined)?.[0]}`);
  return [...flat.formErrors, ...fieldParts].join(", ") || "Validation failed";
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const { id, itemId } = await ctx.params;
    const adminCtx = await requireAdmin();
    if (!adminCtx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const existing = await loadOwnedItem(id, itemId, adminCtx.organization.id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 422 });

    const item = await prisma.catalogItem.update({ where: { id: itemId }, data: parsed.data });
    return NextResponse.json({ item });
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const { id, itemId } = await ctx.params;
    const adminCtx = await requireAdmin();
    if (!adminCtx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const existing = await loadOwnedItem(id, itemId, adminCtx.organization.id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.catalogItem.delete({ where: { id: itemId } });
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}
