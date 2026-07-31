import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { resolveReadActor } from "@/lib/api-auth";

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

const CATALOG_SELECT = {
  id: true, organizationId: true, name: true, type: true, status: true, description: true,
  supplierId: true, supplier: { select: { name: true } },
  punchoutUrl: true, cxmlFromDomain: true, cxmlFromIdentity: true,
  cxmlToDomain: true, cxmlToIdentity: true, cxmlSenderDomain: true, cxmlSenderIdentity: true,
  createdAt: true, updatedAt: true,
  items: { where: { active: true }, orderBy: { name: "asc" as const } },
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const auth = await resolveReadActor(req, "catalogs:read");
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const catalog = await prisma.catalog.findFirst({
      where: { id, organizationId: auth.actor.organizationId },
      select: CATALOG_SELECT,
    });
    if (!catalog) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ catalog });
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  description: z.preprocess(emptyToUndefined, z.string().optional()),
  punchoutUrl: z.preprocess(emptyToUndefined, z.string().url().optional()),
  cxmlFromDomain: z.preprocess(emptyToUndefined, z.string().optional()),
  cxmlFromIdentity: z.preprocess(emptyToUndefined, z.string().optional()),
  cxmlToDomain: z.preprocess(emptyToUndefined, z.string().optional()),
  cxmlToIdentity: z.preprocess(emptyToUndefined, z.string().optional()),
  cxmlSenderDomain: z.preprocess(emptyToUndefined, z.string().optional()),
  cxmlSenderIdentity: z.preprocess(emptyToUndefined, z.string().optional()),
  cxmlSharedSecret: z.preprocess(emptyToUndefined, z.string().optional()),
});

function zodErrorMessage(err: z.ZodError): string {
  const flat = err.flatten();
  const fieldParts = Object.entries(flat.fieldErrors).map(([k, v]) => `${k}: ${(v as string[] | undefined)?.[0]}`);
  return [...flat.formErrors, ...fieldParts].join(", ") || "Validation failed";
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const adminCtx = await requireAdmin();
    if (!adminCtx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const existing = await prisma.catalog.findFirst({ where: { id, organizationId: adminCtx.organization.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 422 });

    const catalog = await prisma.catalog.update({ where: { id }, data: parsed.data, select: CATALOG_SELECT });
    return NextResponse.json({ catalog });
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const adminCtx = await requireAdmin();
    if (!adminCtx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const existing = await prisma.catalog.findFirst({ where: { id, organizationId: adminCtx.organization.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.catalog.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}
