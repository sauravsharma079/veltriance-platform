import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { contractAccess } from "@/lib/contracts-access";
import { CONTRACT_TYPES, EDITABLE } from "@/lib/contracts";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const a = await contractAccess();
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const contract = await prisma.contract.findFirst({
    where: { id, organizationId: a.org.id },
    include: {
      supplier: { select: { id: true, name: true, contactEmail: true, contactName: true } },
      owner: { select: { id: true, name: true } },
      // tokenHash is deliberately not selected: it's the credential behind a signing link.
      signatories: { select: { id: true, party: true, name: true, email: true, title: true, status: true, signedName: true, signedAt: true, signedVersion: true, signedDocHash: true, declineReason: true, invitedAt: true }, orderBy: { createdAt: "asc" } },
      comments: { orderBy: { createdAt: "asc" } },
      versions: { select: { versionNumber: true, changeNote: true, source: true, createdByName: true, createdAt: true }, orderBy: { versionNumber: "desc" } },
    },
  });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Text for the latest few versions (current + what to diff against); older ones on request.
  const wanted = contract.versions.slice(0, 5).map(v => v.versionNumber);
  const bodies = await prisma.contractVersion.findMany({ where: { contractId: id, versionNumber: { in: wanted } }, select: { versionNumber: true, body: true } });
  return NextResponse.json({ contract, bodies: Object.fromEntries(bodies.map(b => [b.versionNumber, b.body])) });
}

const patchSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  type: z.enum(CONTRACT_TYPES).optional(),
  supplierId: z.string().min(1).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  value: z.number().nonnegative().nullable().optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  startDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(),
  autoRenew: z.boolean().optional(),
  noticeDays: z.number().int().min(0).max(365).optional(),
});

/** Terms can only change while drafting or negotiating; after that, only by a new contract/amendment. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const a = await contractAccess();
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const existing = await prisma.contract.findFirst({ where: { id, organizationId: a.org.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!EDITABLE.includes(existing.status)) return NextResponse.json({ error: `A ${existing.status.replace("_", " ").toLowerCase()} contract can't be edited` }, { status: 422 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 });
  const d = parsed.data;
  const start = d.startDate !== undefined ? d.startDate : existing.startDate?.toISOString().slice(0, 10);
  const end = d.endDate !== undefined ? d.endDate : existing.endDate?.toISOString().slice(0, 10);
  if (start && end && end < start) return NextResponse.json({ error: "End date can't be before the start date" }, { status: 422 });
  if (d.supplierId) {
    const sup = await prisma.supplier.findFirst({ where: { id: d.supplierId, organizationId: a.org.id }, select: { id: true } });
    if (!sup) return NextResponse.json({ error: "Supplier not found" }, { status: 422 });
  }

  const contract = await prisma.contract.update({
    where: { id },
    data: {
      ...(d.title !== undefined && { title: d.title }), ...(d.type !== undefined && { type: d.type }),
      ...(d.supplierId !== undefined && { supplierId: d.supplierId }), ...(d.description !== undefined && { description: d.description }),
      ...(d.value !== undefined && { value: d.value }), ...(d.currency !== undefined && { currency: d.currency }),
      ...(d.startDate !== undefined && { startDate: d.startDate ? new Date(d.startDate) : null }),
      ...(d.endDate !== undefined && { endDate: d.endDate ? new Date(d.endDate) : null }),
      ...(d.autoRenew !== undefined && { autoRenew: d.autoRenew }), ...(d.noticeDays !== undefined && { noticeDays: d.noticeDays }),
    },
  });
  await logAudit({
    organizationId: a.org.id, userId: a.profile.id, userName: a.profile.name,
    action: "UPDATED", entity: "CONTRACT", entityId: id, entityLabel: `${existing.contractNumber} ${existing.title}`,
    details: { fields: Object.keys(d) },
  });
  return NextResponse.json({ contract });
}
