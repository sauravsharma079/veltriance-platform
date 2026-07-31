import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUploadActor } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveUploadActor(req, "suppliers:write");
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { organizationId, userId, userName } = auth.actor;

    const { rows } = await req.json() as { rows: Record<string,string>[] };
    if (!Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });

    const results: { created:number; skipped:number; errors:string[] } = { created:0, skipped:0, errors:[] };

    for (const row of rows) {
      try {
        const name = (row.name || row.Name || row.NAME || "").trim();
        if (!name) { results.errors.push(`Row skipped: missing name`); continue; }
        const code = (row.code || row.Code || row.CODE || "").trim();
        if (code) {
          const existing = await prisma.supplier.findFirst({ where: { organizationId, code } });
          if (existing) { results.skipped++; continue; }
        }
        const count = await prisma.supplier.count({ where: { organizationId } });
        const autoCode = code || `SUP-${String(count + 101).padStart(3, "0")}`;
        await prisma.supplier.create({ data: {
          organizationId, name, code: autoCode,
          status: "ACTIVE", onboardingStage: "ACTIVE",
          category:     (row.category || row.Category || "").trim() || null,
          contactEmail: (row.contactEmail || row.contact_email || row.email || "").trim() || null,
          contactName:  (row.contactName || row.contact_name || row.contact || "").trim() || null,
          contactPhone: (row.contactPhone || row.contact_phone || row.phone || "").trim() || null,
          city:         (row.city || row.City || "").trim() || null,
          country:      (row.country || row.Country || "India").trim(),
          tier:         (row.tier || row.Tier || "Tier 2").trim(),
          paymentTerms: (row.paymentTerms || row.payment_terms || "Net 30").trim(),
          currency:     "INR",
          requestedById: userId,
        }});
        results.created++;
      } catch (e: any) {
        results.errors.push(`Row "${row.name}": ${e.message}`);
      }
    }

    await logAudit({ organizationId, userId: userId ?? undefined, userName,
      action: "UPLOADED", entity: "SUPPLIER",
      details: { created: results.created, skipped: results.skipped, total: rows.length } });

    return NextResponse.json(results);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
