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
    const { rows } = await req.json() as { rows: Record<string,string>[] };
    if (!Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ error: "No rows" }, { status: 400 });

    const results = { created:0, updated:0, skipped:0, errors:[] as string[] };
    for (const row of rows) {
      try {
        const type  = (row.type  || row.Type  || "").trim().toUpperCase();
        const code  = (row.code  || row.Code  || "").trim().toUpperCase();
        const label = (row.label || row.Label || row.name || row.Name || "").trim();
        if (!type || !code || !label) { results.errors.push(`Row missing type/code/label`); continue; }
        const sort = parseInt(row.sortOrder || row.sort_order || "0") || 0;
        const existing = await prisma.lookup.findFirst({ where: { organizationId: org.id, type, code } });
        if (existing) {
          await prisma.lookup.update({ where: { id: existing.id }, data: { label, sortOrder: sort || existing.sortOrder } });
          results.updated++;
        } else {
          const count = await prisma.lookup.count({ where: { organizationId: org.id, type } });
          await prisma.lookup.create({ data: { organizationId: org.id, type, code, label, sortOrder: sort || count+1, isActive: true } });
          results.created++;
        }
      } catch (e: any) { results.errors.push(e.message); }
    }
    if (profile) await logAudit({ organizationId: org.id, userId: profile.id, userName: profile.name,
      action: "UPLOADED", entity: "LOOKUP", details: results });
    return NextResponse.json(results);
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}
