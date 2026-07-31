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
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

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
          const existing = await prisma.supplier.findFirst({ where: { organizationId: org.id, code } });
          if (existing) { results.skipped++; continue; }
        }
        const count = await prisma.supplier.count({ where: { organizationId: org.id } });
        const autoCode = code || `SUP-${String(count + 101).padStart(3, "0")}`;
        await prisma.supplier.create({ data: {
          organizationId: org.id, name, code: autoCode,
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
          requestedById: profile.id,
        }});
        results.created++;
      } catch (e: any) {
        results.errors.push(`Row "${row.name}": ${e.message}`);
      }
    }

    await logAudit({ organizationId: org.id, userId: profile.id, userName: profile.name,
      action: "UPLOADED", entity: "SUPPLIER",
      details: { created: results.created, skipped: results.skipped, total: rows.length } });

    return NextResponse.json(results);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
