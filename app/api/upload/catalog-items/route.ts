import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const profile = await prisma.user.findUnique({ where: { authId: user.id } });
    const { catalogId, rows } = await req.json() as { catalogId: string; rows: Record<string,string>[] };
    if (!catalogId || !Array.isArray(rows))
      return NextResponse.json({ error: "catalogId and rows required" }, { status: 400 });

    const catalog = await prisma.integration.findFirst({ where: { id: catalogId, organizationId: org.id } });
    if (!catalog) return NextResponse.json({ error: "Catalog not found" }, { status: 404 });

    const existingConfig = (catalog.config as any) || {};
    const existingItems: any[] = existingConfig.items || [];
    const existingSkus = new Set(existingItems.map((i: any) => i.sku));

    const newItems = [];
    for (const row of rows) {
      const sku  = (row.sku  || row.SKU  || row.code || "").trim();
      const name = (row.name || row.Name || row.description || "").trim();
      const price = parseFloat(row.unitPrice || row.unit_price || row.price || "0");
      if (!name) continue;
      if (sku && existingSkus.has(sku)) continue;
      newItems.push({
        sku:         sku || `ITEM-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        name,
        unitPrice:   price,
        currency:    row.currency || "INR",
        category:    row.category || row.Category || "General",
        gl:          row.gl || row.glAccount || row.gl_account || "6100",
        unit:        row.unit || "Each",
        leadDays:    parseInt(row.leadDays || row.lead_days || "3"),
        description: row.description || row.desc || name,
      });
    }

    await (prisma.integration.update as any)({
      where: { id: catalogId },
      data: { config: { ...existingConfig, items: [...existingItems, ...newItems] } },
    });

    if (profile) await logAudit({ organizationId: org.id, userId: profile.id, userName: profile.name,
      action: "UPLOADED", entity: "CATALOG", entityId: catalogId,
      entityLabel: catalog.name, details: { added: newItems.length, total: existingItems.length + newItems.length } });

    return NextResponse.json({ created: newItems.length, total: existingItems.length + newItems.length });
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}
