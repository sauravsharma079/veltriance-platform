import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { sendPurchaseOrder } from "@/lib/po-send";
import { logAudit } from "@/lib/audit";

const REVISABLE_STATUSES = ["SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED"];

/**
 * POST /api/purchase-orders/[id]/revise
 *
 * "Change order" — amends a PO that's already been transmitted (line item
 * quantities/prices, payment terms, delivery, notes) and re-sends it to the
 * supplier via whatever routing method the PO already uses, labeled as a
 * change order rather than a brand-new PO. Bumps changeOrderNumber so both
 * sides can tell which revision they're looking at.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !organization || profile.organizationId !== organization.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "PROCUREMENT" && profile.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const po = await prisma.purchaseOrder.findFirst({
    where: { id, organizationId: organization.id },
    include: { lineItems: true },
  });
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!REVISABLE_STATUSES.includes(po.status))
    return NextResponse.json({ error: `Cannot revise a PO in ${po.status} status` }, { status: 422 });

  const body = await req.json().catch(() => ({}));
  const lineUpdates = Array.isArray(body.lineItems) ? body.lineItems as { id: string; quantity?: number; unitPrice?: number }[] : [];

  const headerUpdate: Record<string, unknown> = {};
  if (body.paymentTerms !== undefined) headerUpdate.paymentTerms = body.paymentTerms;
  if (body.deliveryAddress !== undefined) headerUpdate.deliveryAddress = body.deliveryAddress;
  if (body.notes !== undefined) headerUpdate.notes = body.notes;
  if (body.expectedDelivery !== undefined) headerUpdate.expectedDelivery = body.expectedDelivery ? new Date(body.expectedDelivery) : null;

  await prisma.$transaction(async (tx) => {
    for (const li of lineUpdates) {
      const existing = po.lineItems.find(x => x.id === li.id);
      if (!existing) continue;
      const quantity = li.quantity ?? Number(existing.quantity);
      const unitPrice = li.unitPrice ?? Number(existing.unitPrice);
      await tx.purchaseOrderLineItem.update({
        where: { id: li.id },
        data: { quantity, unitPrice, lineTotal: quantity * unitPrice },
      });
    }

    if (lineUpdates.length > 0) {
      const refreshed = await tx.purchaseOrderLineItem.findMany({ where: { purchaseOrderId: id } });
      const subtotal = refreshed.reduce((s, li) => s + Number(li.lineTotal), 0);
      headerUpdate.subtotal = subtotal;
      headerUpdate.totalAmount = subtotal + Number(po.taxAmount);
    }

    if (Object.keys(headerUpdate).length > 0) {
      await tx.purchaseOrder.update({ where: { id }, data: headerUpdate });
    }
  });

  const sendResult = await sendPurchaseOrder({
    poId: id, organizationId: organization.id, supabase,
    actorName: profile.name, actorId: profile.id, isChangeOrder: true,
  });

  if ("error" in sendResult) return NextResponse.json({ error: sendResult.error }, { status: sendResult.status });

  await logAudit({
    organizationId: organization.id, userId: profile.id, userName: profile.name,
    action: "UPDATED", entity: "PURCHASE_ORDER", entityId: id, entityLabel: po.poNumber,
    details: { changeOrder: true, changeOrderNumber: sendResult.changeOrderNumber, fields: Object.keys(headerUpdate), revisedLines: lineUpdates.length },
  });

  return NextResponse.json({ success: true, changeOrderNumber: sendResult.changeOrderNumber, detail: sendResult.detail });
}
