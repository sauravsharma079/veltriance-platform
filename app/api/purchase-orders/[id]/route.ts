import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getMemberOrganization } from "@/lib/tenant";
import { purchaseOrderScope } from "@/lib/permissions";
import { errorMessage } from "@/lib/errors";

export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const org = await getMemberOrganization(user.id);
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const scope = await purchaseOrderScope(user.id, org.id);
    if (!scope) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const po = await prisma.purchaseOrder.findFirst({
      where: { id, organizationId: org.id, ...scope },
      include: {
        supplier: { select: { id: true, name: true, contactEmail: true, contactName: true } },
        organization: { select: { name: true } },
        lineItems: true,
        requisition: { select: { requisitionNumber: true, title: true } },
        createdBy: { select: { name: true, email: true } },
        chartOfAccount: { select: { name: true, code: true } },
      },
    });
    if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Map to exact shape the page expects
    const purchaseOrder = {
      ...po,
      taxAmount: String(po.taxAmount),
      subtotal: String(po.subtotal),
      totalAmount: String(po.totalAmount),
      // Fall back to the supplier's contact email when no PO-specific one is set
      supplierEmail: po.supplierEmail ?? po.supplier?.contactEmail ?? null,
      // lineItems with string amounts
      lineItems: po.lineItems.map(li => ({
        ...li,
        quantity: String(li.quantity),
        unitPrice: String(li.unitPrice),
        lineTotal: String(li.lineTotal),
      })),
    };

    return NextResponse.json({ purchaseOrder });
  } catch (e) {
    console.error("[po/id GET]", errorMessage(e));
    return NextResponse.json({ error: errorMessage(e, "Failed") }, { status: 500 });
  }
}

const patchSchema = z.object({
  supplierId: z.string().min(1).optional(),
  supplierEmail: z.string().email().nullable().optional(),
  notes: z.string().nullable().optional(),
  paymentTerms: z.string().nullable().optional(),
  deliveryAddress: z.string().nullable().optional(),
  // Where cXML orders are POSTed; the page saves this right before a cXML send.
  cxmlEndpoint: z.string().url().refine(u => /^https?:\/\//i.test(u), "Must be an http(s) URL").nullable().optional(),
});

/**
 * Edits a DRAFT PO's header (supplier, contact, terms, delivery, cXML endpoint).
 * Status changes are not accepted here — they belong to the send / receive
 * flows — and a PO that has already gone out is amended through the
 * change-order endpoint (/revise) so the supplier is told about it.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const org = await getMemberOrganization(user.id);
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const profile = await prisma.user.findFirst({ where: { authId: user.id, organizationId: org.id }, select: { id: true, name: true, role: true } });
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (profile.role !== "PROCUREMENT" && profile.role !== "ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 });
    const data = parsed.data;

    const existing = await prisma.purchaseOrder.findFirst({ where: { id, organizationId: org.id }, select: { id: true, poNumber: true, status: true } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.status !== "DRAFT")
      return NextResponse.json({ error: `A ${existing.status} PO can't be edited directly — use a change order instead` }, { status: 422 });

    if (data.supplierId) {
      const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, organizationId: org.id }, select: { id: true } });
      if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 422 });
    }

    const purchaseOrder = await prisma.purchaseOrder.update({
      where: { id },
      data,
      include: {
        supplier: { select: { id: true, name: true, contactEmail: true, contactName: true } },
        requisition: { select: { requisitionNumber: true, title: true } },
        lineItems: true,
      },
    });

    await logAudit({
      organizationId: org.id, userId: profile.id, userName: profile.name,
      action: "UPDATED", entity: "PURCHASE_ORDER", entityId: id, entityLabel: existing.poNumber,
      details: { fields: Object.keys(data) },
    });
    return NextResponse.json({ purchaseOrder });
  } catch (e) {
    console.error("[po/id PATCH]", errorMessage(e));
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
