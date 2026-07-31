import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUploadActor } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveUploadActor(req, "catalogs:write");
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { organizationId, userId, userName } = auth.actor;

    const { catalogId, rows } = await req.json() as { catalogId: string; rows: Record<string,string>[] };
    if (!catalogId || !Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ error: "catalogId and rows required" }, { status: 400 });

    const catalog = await prisma.catalog.findFirst({ where: { id: catalogId, organizationId } });
    if (!catalog) return NextResponse.json({ error: "Catalog not found" }, { status: 404 });
    if (catalog.type !== "HOSTED")
      return NextResponse.json({ error: "Items can only be uploaded to hosted catalogs" }, { status: 422 });

    const results = { created: 0, updated: 0, errors: [] as string[] };
    for (const row of rows) {
      try {
        const sku  = (row.sku  || row.SKU  || row.code || "").trim();
        const name = (row.name || row.Name || row.description || "").trim();
        if (!name) { results.errors.push("Row skipped: missing name"); continue; }
        const finalSku = sku || `ITEM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        const category = (row.category || row.Category || "").trim();
        const unit = (row.unit || "").trim();
        const leadDaysRaw = row.leadDays || row.lead_days || "";
        const supplierName = (row.supplier || row.supplierName || row.supplier_name || "").trim();

        if (!category) { results.errors.push(`Row "${name}": missing category`); continue; }
        if (!unit) { results.errors.push(`Row "${name}": missing unit`); continue; }
        if (!leadDaysRaw) { results.errors.push(`Row "${name}": missing leadDays`); continue; }
        if (!supplierName) { results.errors.push(`Row "${name}": missing supplier`); continue; }

        const supplier = await prisma.supplier.findFirst({
          where: { organizationId, name: { contains: supplierName, mode: "insensitive" } },
        });
        if (!supplier) { results.errors.push(`Row "${name}": no supplier found matching "${supplierName}"`); continue; }

        const data = {
          name,
          unitPrice: parseFloat(row.unitPrice || row.unit_price || row.price || "0") || 0,
          currency: row.currency || "INR",
          category,
          supplierId: supplier.id,
          unit,
          leadDays: parseInt(leadDaysRaw),
          description: row.description || row.desc || null,
        };
        const existing = await prisma.catalogItem.findUnique({ where: { catalogId_sku: { catalogId, sku: finalSku } } });
        if (existing) {
          await prisma.catalogItem.update({ where: { id: existing.id }, data });
          results.updated++;
        } else {
          await prisma.catalogItem.create({ data: { catalogId, sku: finalSku, ...data } });
          results.created++;
        }
      } catch (e: any) {
        results.errors.push(`Row "${row.name || row.sku}": ${e.message?.split("\n")[0]}`);
      }
    }

    await logAudit({ organizationId, userId: userId ?? undefined, userName,
      action: "UPLOADED", entity: "CATALOG", entityId: catalogId, entityLabel: catalog.name,
      details: { created: results.created, updated: results.updated, total: rows.length } });

    return NextResponse.json(results);
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}
