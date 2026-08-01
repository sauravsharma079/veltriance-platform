import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUploadActor } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveUploadActor(req, "coa:write");
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { organizationId, userId, userName } = auth.actor;

    const { coaId, rows } = await req.json() as { coaId: string; rows: Record<string, string>[] };
    if (!coaId || !Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ error: "coaId and rows required" }, { status: 400 });

    const coa = await prisma.chartOfAccount.findFirst({
      where: { id: coaId, organizationId },
      include: { segments: true },
    });
    if (!coa) return NextResponse.json({ error: "Chart of accounts not found" }, { status: 404 });
    if (coa.segments.length === 0)
      return NextResponse.json({ error: "This chart of accounts has no segments defined yet — add at least one segment first." }, { status: 422 });

    const results = { created: 0, updated: 0, errors: [] as string[] };
    for (const row of rows) {
      try {
        const segmentRef = (row.segment || row.Segment || row.segmentName || row.segment_name || "").trim();
        const code = (row.code || row.Code || "").trim();
        const description = (row.description || row.Description || row.label || row.Label || "").trim();
        if (!segmentRef) { results.errors.push(`Row "${code || "?"}": missing segment`); continue; }
        if (!code) { results.errors.push(`Row skipped: missing code`); continue; }
        if (!description) { results.errors.push(`Row "${code}": missing description`); continue; }

        const segment = coa.segments.find(s =>
          String(s.position) === segmentRef || s.name.toLowerCase() === segmentRef.toLowerCase()
        );
        if (!segment) { results.errors.push(`Row "${code}": no segment matching "${segmentRef}" (use the segment's position number or exact name)`); continue; }

        const existing = await prisma.coaSegmentValue.findFirst({ where: { segmentId: segment.id, code } });
        if (existing) {
          await prisma.coaSegmentValue.update({ where: { id: existing.id }, data: { description, isActive: true } });
          results.updated++;
        } else {
          await prisma.coaSegmentValue.create({ data: { segmentId: segment.id, code, description } });
          results.created++;
        }
      } catch (e: any) {
        results.errors.push(`Row "${row.code}": ${e.message?.split("\n")[0]}`);
      }
    }

    await logAudit({
      organizationId, userId: userId ?? undefined, userName,
      action: "UPLOADED", entity: "COA", entityId: coaId, entityLabel: coa.name,
      details: { created: results.created, updated: results.updated, total: rows.length },
    });

    return NextResponse.json(results);
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}
