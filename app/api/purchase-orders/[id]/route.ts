import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const po = await prisma.purchaseOrder.findFirst({
      where: { id, organizationId: org.id },
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
      // Page expects deliveryAddress but we store deliveryLocation
      deliveryAddress: (po as any).deliveryLocation ?? (po as any).deliveryAddress ?? null,
      // Page expects taxAmount but we store totalTax
      taxAmount: String((po as any).totalTax ?? (po as any).taxAmount ?? 0),
      subtotal: String((po as any).subtotal ?? 0),
      totalAmount: String((po as any).totalAmount ?? 0),
      // createdBy may not exist on schema — fallback
      createdBy: (po as any).createdBy ?? { name: "System", email: "" },
      // supplierEmail from supplier
      supplierEmail: (po as any).supplierEmail ?? po.supplier?.contactEmail ?? null,
      // lineItems with string amounts
      lineItems: ((po as any).lineItems ?? []).map((li: any) => ({
        ...li,
        quantity: String(li.quantity ?? 0),
        unitPrice: String(li.unitPrice ?? 0),
        lineTotal: String(li.lineTotal ?? 0),
      })),
    };

    return NextResponse.json({ purchaseOrder });
  } catch (e: any) {
    console.error("[po/id GET]", e?.message);
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await req.json();

    // Map deliveryAddress → deliveryLocation for DB
    const updateData: any = {};
    if (body.supplierId !== undefined)   updateData.supplierId    = body.supplierId;
    if (body.supplierEmail !== undefined) updateData.supplierEmail = body.supplierEmail;
    if (body.notes !== undefined)        updateData.notes         = body.notes;
    if (body.paymentTerms !== undefined) updateData.paymentTerms  = body.paymentTerms;
    if (body.deliveryAddress !== undefined) {
      updateData.deliveryLocation = body.deliveryAddress;
      updateData.deliveryAddress  = body.deliveryAddress;
    }
    if (body.status !== undefined)       updateData.status        = body.status;

    const purchaseOrder = await prisma.purchaseOrder.update({
      where: { id, organizationId: org.id },
      data: updateData,
      include: {
        supplier: { select: { id: true, name: true, contactEmail: true, contactName: true } },
        requisition: { select: { requisitionNumber: true, title: true } },
        lineItems: true,
      },
    });
    return NextResponse.json({ purchaseOrder });
  } catch (e: any) {
    console.error("[po/id PATCH]", e?.message);
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
