import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUploadActor } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveUploadActor(req, "lookup_values:write");
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { organizationId, userId, userName } = auth.actor;

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
        const existing = await prisma.lookup.findFirst({ where: { organizationId, type, code } });
        if (existing) {
          await prisma.lookup.update({ where: { id: existing.id }, data: { label, sortOrder: sort || existing.sortOrder } });
          results.updated++;
        } else {
          const count = await prisma.lookup.count({ where: { organizationId, type } });
          await prisma.lookup.create({ data: { organizationId, type, code, label, sortOrder: sort || count+1, isActive: true } });
          results.created++;
        }
      } catch (e: any) { results.errors.push(e.message); }
    }
    await logAudit({ organizationId, userId: userId ?? undefined, userName,
      action: "UPLOADED", entity: "LOOKUP", details: results });
    return NextResponse.json(results);
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}
