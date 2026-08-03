import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { resolveReadActor } from "@/lib/api-auth";
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

// Never return the shared secret to any client.
const CATALOG_SELECT = {
  id: true, organizationId: true, name: true, type: true, status: true, description: true,
  supplierId: true, supplier: { select: { name: true } },
  punchoutUrl: true, cxmlFromDomain: true, cxmlFromIdentity: true,
  cxmlToDomain: true, cxmlToIdentity: true, cxmlSenderDomain: true, cxmlSenderIdentity: true,
  createdAt: true, updatedAt: true,
  _count: { select: { items: true } },
};

export async function GET(req: NextRequest) {
  try {
    const auth = await resolveReadActor(req, "catalogs:read");
    if ("error" in auth) return NextResponse.json({ catalogs: [] });
    const { organizationId } = auth.actor;

    const type = req.nextUrl.searchParams.get("type");
    const status = req.nextUrl.searchParams.get("status");
    const includeItems = req.nextUrl.searchParams.get("includeItems") === "true";

    const catalogs = await prisma.catalog.findMany({
      where: {
        organizationId,
        ...(type ? { type: type as any } : {}),
        ...(status ? { status: status as any } : {}),
      },
      select: includeItems
        ? { ...CATALOG_SELECT, items: { where: { active: true }, orderBy: { name: "asc" }, include: { supplier: { select: { name: true } } } } }
        : CATALOG_SELECT,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ catalogs });
  } catch (e: any) {
    console.error("[catalogs GET]", e?.message);
    return NextResponse.json({ catalogs: [] });
  }
}

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["HOSTED", "PUNCHOUT"]),
  description: z.preprocess(emptyToUndefined, z.string().optional()),
  supplierId: z.preprocess(emptyToUndefined, z.string().optional()),
  punchoutUrl: z.preprocess(emptyToUndefined, z.string().url().optional()),
  cxmlFromDomain: z.preprocess(emptyToUndefined, z.string().optional()),
  cxmlFromIdentity: z.preprocess(emptyToUndefined, z.string().optional()),
  cxmlToDomain: z.preprocess(emptyToUndefined, z.string().optional()),
  cxmlToIdentity: z.preprocess(emptyToUndefined, z.string().optional()),
  cxmlSenderDomain: z.preprocess(emptyToUndefined, z.string().optional()),
  cxmlSenderIdentity: z.preprocess(emptyToUndefined, z.string().optional()),
  cxmlSharedSecret: z.preprocess(emptyToUndefined, z.string().optional()),
}).refine(d => d.type !== "PUNCHOUT" || !!d.punchoutUrl, {
  message: "punchoutUrl is required for punchout catalogs",
}).refine(d => d.type !== "HOSTED" || !!d.description, {
  message: "description is required for hosted catalogs",
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

    const catalog = await prisma.catalog.create({
      data: { organizationId: ctx.organization.id, ...d },
      select: CATALOG_SELECT,
    });
    await logAudit({
      organizationId: ctx.organization.id, userId: ctx.profile.id, userName: ctx.profile.name,
      action: "CREATED", entity: "CATALOG", entityId: catalog.id, entityLabel: catalog.name,
      details: { type: catalog.type },
    });
    return NextResponse.json({ catalog }, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "A catalog with this name already exists" }, { status: 409 });
    console.error("[catalogs POST]", e?.message);
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
