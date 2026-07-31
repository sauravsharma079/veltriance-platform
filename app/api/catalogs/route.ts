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
      select: includeItems ? { ...CATALOG_SELECT, items: { where: { active: true }, orderBy: { name: "asc" } } } : CATALOG_SELECT,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ catalogs });
  } catch (e: any) {
    console.error("[catalogs GET]", e?.message);
    return NextResponse.json({ catalogs: [] });
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["HOSTED", "PUNCHOUT"]),
  description: z.string().optional(),
  supplierId: z.string().optional(),
  punchoutUrl: z.string().url().optional(),
  cxmlFromDomain: z.string().optional(),
  cxmlFromIdentity: z.string().optional(),
  cxmlToDomain: z.string().optional(),
  cxmlToIdentity: z.string().optional(),
  cxmlSenderDomain: z.string().optional(),
  cxmlSenderIdentity: z.string().optional(),
  cxmlSharedSecret: z.string().optional(),
}).refine(d => d.type !== "PUNCHOUT" || !!d.punchoutUrl, {
  message: "punchoutUrl is required for punchout catalogs",
});

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAdmin();
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    const d = parsed.data;

    const catalog = await prisma.catalog.create({
      data: { organizationId: ctx.organization.id, ...d },
      select: CATALOG_SELECT,
    });
    return NextResponse.json({ catalog }, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "A catalog with this name already exists" }, { status: 409 });
    console.error("[catalogs POST]", e?.message);
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
