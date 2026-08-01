import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUploadActor } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveUploadActor(req, "lookup_values:write");
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { organizationId, userId, userName } = auth.actor;

    const { rows } = await req.json() as { rows: Record<string, string>[] };
    if (!Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });

    const results = { created: 0, updated: 0, errors: [] as string[] };
    const knownCodes = new Set(
      (await prisma.lookup.findMany({ where: { organizationId, type: "COMMODITY" }, select: { code: true } })).map(l => l.code)
    );

    // Rows can be in any order — a level-3 item's parent might appear further
    // down the CSV. Process in up to 3 passes so a parent created earlier in
    // the same upload is available before its children are processed.
    let remaining = rows.map((row, i) => ({ row, i }));
    for (let pass = 0; pass < 3 && remaining.length > 0; pass++) {
      const stillRemaining: typeof remaining = [];
      for (const { row, i } of remaining) {
        const code = (row.code || row.Code || "").trim().toUpperCase();
        const label = (row.label || row.Label || row.name || row.Name || "").trim();
        const parentCode = (row.parentCode || row.parent_code || row.parent || row.Parent || "").trim().toUpperCase();
        if (!code || !label) { results.errors.push(`Row ${i + 2}: missing code or label`); continue; }
        if (parentCode && !knownCodes.has(parentCode)) { stillRemaining.push({ row, i }); continue; }

        try {
          const existing = await prisma.lookup.findFirst({ where: { organizationId, type: "COMMODITY", code } });
          if (existing) {
            await prisma.lookup.update({ where: { id: existing.id }, data: { label, parentCode: parentCode || null } });
            results.updated++;
          } else {
            const count = await prisma.lookup.count({ where: { organizationId, type: "COMMODITY" } });
            await prisma.lookup.create({ data: { organizationId, type: "COMMODITY", code, label, parentCode: parentCode || null, sortOrder: count + 1, active: true } });
            results.created++;
          }
          knownCodes.add(code);
        } catch (e: any) {
          results.errors.push(`Row "${code}": ${e.message?.split("\n")[0]}`);
        }
      }
      remaining = stillRemaining;
    }
    for (const { row, i } of remaining) {
      results.errors.push(`Row ${i + 2} ("${row.code}"): parent code "${row.parentCode || row.parent_code}" not found — check the spelling or upload parents first`);
    }

    await logAudit({
      organizationId, userId: userId ?? undefined, userName,
      action: "UPLOADED", entity: "LOOKUP",
      details: { created: results.created, updated: results.updated, total: rows.length, commodity: true },
    });

    return NextResponse.json(results);
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}
