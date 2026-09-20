import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getMemberOrganization } from "@/lib/tenant";
import { moduleGuard } from "@/lib/licensing";
import { postReceipt, mayReceive, RECEIVABLE } from "@/lib/receiving";

async function ctx() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const org = await getMemberOrganization(user.id);
  if (!org) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const profile = await prisma.user.findFirst({ where: { authId: user.id, organizationId: org.id }, select: { id: true, name: true, role: true } });
  if (!profile) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const blocked = moduleGuard(org, "INTAKE_TO_PO");
  if (blocked) return { error: blocked };
  return { org, profile };
}

/** What's been received so far, and what's still outstanding, per line. */
export async function GET(_req: NextRequest, c: { params: Promise<{ id: string }> }) {
  const a = await ctx();
  if ("error" in a) return a.error;
  const { id } = await c.params;
  const po = await prisma.purchaseOrder.findFirst({
    where: { id, organizationId: a.org.id },
    include: { lineItems: { orderBy: { createdAt: "asc" } }, receipts: { orderBy: { receivedAt: "desc" }, include: { receivedBy: { select: { name: true } }, lines: true } } },
  });
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const canReceive = RECEIVABLE.includes(po.status) && (await mayReceive(a.profile, po));
  return NextResponse.json({
    poStatus: po.status, canReceive,
    lines: po.lineItems.map(l => ({ id: l.id, description: l.description, unit: l.unit, ordered: Number(l.quantity), received: Number(l.receivedQty), remaining: Math.max(0, Number(l.quantity) - Number(l.receivedQty)) })),
    receipts: po.receipts.map(r => ({ id: r.id, receiptNumber: r.receiptNumber, receivedAt: r.receivedAt, receivedBy: r.receivedBy.name, deliveryNote: r.deliveryNote, notes: r.notes, lines: r.lines.map(l => ({ poLineId: l.poLineId, accepted: Number(l.quantityAccepted), rejected: Number(l.quantityRejected), reason: l.rejectionReason })) })),
  });
}

const schema = z.object({
  lines: z.array(z.object({ poLineId: z.string().min(1), accepted: z.number().min(0).max(1e9), rejected: z.number().min(0).max(1e9).optional(), reason: z.string().trim().max(300).optional() })).min(1).max(200),
  deliveryNote: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function POST(req: NextRequest, c: { params: Promise<{ id: string }> }) {
  const a = await ctx();
  if ("error" in a) return a.error;
  const { id } = await c.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 });
  const po = await prisma.purchaseOrder.findFirst({ where: { id, organizationId: a.org.id }, select: { createdById: true, requisitionId: true } });
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await mayReceive(a.profile, po))) return NextResponse.json({ error: "Only Procurement, an Admin, or the person who ordered these goods can record their receipt" }, { status: 403 });
  const r = await postReceipt({ organizationId: a.org.id, actor: { id: a.profile.id, name: a.profile.name }, purchaseOrderId: id, ...parsed.data });
  return NextResponse.json(r.json, { status: r.status });
}
