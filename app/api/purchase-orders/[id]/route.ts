import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
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

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const org = await getMemberOrganization(user.id);
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await req.json();

    // Map deliveryAddress → deliveryLocation for DB
    const updateData: any = {};
    if (body.supplierId !== undefined)   updateData.supplierId    = body.supplierId;
    if (body.supplierEmail !== undefined) updateData.supplierEmail = body.supplierEmail;
    if (body.notes !== undefined)        updateData.notes         = body.notes;
    if (body.paymentTerms !== undefined) updateData.paymentTerms  = body.paymentTerms;
    if (body.deliveryAddress !== undefined) updateData.deliveryAddress = body.deliveryAddress;
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
  } catch (e) {
    console.error("[po/id PATCH]", errorMessage(e));
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
