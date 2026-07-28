import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ catalogs: [] });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ catalogs: [] });
    const type = req.nextUrl.searchParams.get("type"); // HOSTED_CATALOG | PUNCHOUT
    const integrations = await prisma.integration.findMany({
      where: {
        organizationId: org.id,
        ...(type ? { type } : { type: { in: ["HOSTED_CATALOG", "PUNCHOUT"] } }),
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ catalogs: integrations });
  } catch (e: any) {
    console.error("[catalogs GET]", e?.message);
    return NextResponse.json({ catalogs: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await req.json();
    const { name, type, supplierId, supplierName, description, punchoutUrl, protocol, items } = body;
    if (!name?.trim() || !type) return NextResponse.json({ error: "name and type required" }, { status: 400 });

    const catalog = await (prisma.integration.create as any)({
      data: {
        organizationId: org.id,
        name: name.trim(),
        type,
        status: "ACTIVE",
        provider: type === "PUNCHOUT" ? (protocol || "CXML") : "HOSTED",
        config: {
          description: description || "",
          supplierId: supplierId || null,
          supplierName: supplierName || "",
          punchoutUrl: punchoutUrl || null,
          protocol: protocol || "CXML",
          items: Array.isArray(items) ? items : [],
          createdAt: new Date().toISOString(),
        },
      },
    });
    return NextResponse.json({ catalog }, { status: 201 });
  } catch (e: any) {
    console.error("[catalogs POST]", e?.message);
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
