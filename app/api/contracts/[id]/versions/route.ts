import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { contractAccess } from "@/lib/contracts-access";
import { createVersion, VersionError } from "@/lib/contract-versions";

const schema = z.object({ body: z.string().min(1).max(200_000), changeNote: z.string().max(500).optional() });

/** Save an edit as a new immutable version. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await contractAccess();
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 });
  const contract = await prisma.contract.findFirst({ where: { id, organizationId: a.org.id }, select: { id: true, contractNumber: true, title: true } });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const version = await createVersion({ contractId: id, organizationId: a.org.id, body: parsed.data.body, changeNote: parsed.data.changeNote, source: "HUMAN", by: { id: a.profile.id, name: a.profile.name } });
    await logAudit({
      organizationId: a.org.id, userId: a.profile.id, userName: a.profile.name,
      action: "UPDATED", entity: "CONTRACT", entityId: id, entityLabel: `${contract.contractNumber} ${contract.title}`,
      details: { version: version.versionNumber },
    });
    return NextResponse.json({ version }, { status: 201 });
  } catch (e) {
    if (e instanceof VersionError) return NextResponse.json({ error: e.message }, { status: 422 });
    throw e;
  }
}
