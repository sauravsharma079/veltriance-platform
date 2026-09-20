import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { invoiceAccess } from "@/lib/invoice-access";

export async function GET() {
  const a = await invoiceAccess();
  if ("error" in a) return a.error;
  return NextResponse.json({ pricePct: a.org.matchPriceTolerancePct, qtyPct: a.org.matchQtyTolerancePct, autoApprove: a.org.invoiceAutoApprove, canEdit: a.profile.role === "ADMIN" });
}

const schema = z.object({ pricePct: z.number().min(0).max(25).optional(), qtyPct: z.number().min(0).max(25).optional(), autoApprove: z.boolean().optional() });

/** The organisation's match rules. ADMIN only: loosening them changes what gets paid without a person looking. */
export async function PUT(req: NextRequest) {
  const a = await invoiceAccess();
  if ("error" in a) return a.error;
  if (a.profile.role !== "ADMIN") return NextResponse.json({ error: "Only an Admin can change the match rules" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 });
  const d = parsed.data;
  await prisma.organization.update({ where: { id: a.org.id }, data: { ...(d.pricePct !== undefined && { matchPriceTolerancePct: d.pricePct }), ...(d.qtyPct !== undefined && { matchQtyTolerancePct: d.qtyPct }), ...(d.autoApprove !== undefined && { invoiceAutoApprove: d.autoApprove }) } });
  await logAudit({ organizationId: a.org.id, userId: a.profile.id, userName: a.profile.name, action: "UPDATED", entity: "INVOICE", entityId: a.org.id, entityLabel: "Invoice match rules", details: { from: { pricePct: a.org.matchPriceTolerancePct, qtyPct: a.org.matchQtyTolerancePct, autoApprove: a.org.invoiceAutoApprove }, to: d } });
  return NextResponse.json({ ok: true });
}
