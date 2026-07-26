import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { generatePONumber } from "@/lib/po-number";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !organization || profile.organizationId !== organization.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status");

  const pos = await prisma.purchaseOrder.findMany({
    where: {
      organizationId: organization.id,
      ...(status ? { status: status as never } : {}),
    },
    include: {
      supplier: { select: { name: true } },
      createdBy: { select: { name: true } },
      requisition: { select: { requisitionNumber: true, title: true } },
      lineItems: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ purchaseOrders: pos });
}

const createSchema = z.object({
  requisitionId: z.string().optional(),
  supplierId: z.string().optional(),
  supplierEmail: z.string().email().optional(),
  routingMethod: z.enum(["EMAIL", "CXML", "MANUAL"]).default("EMAIL"),
  cxmlEndpoint: z.string().url().optional(),
  currency: z.string().default("USD"),
  paymentTerms: z.string().optional(),
  deliveryAddress: z.string().optional(),
  notes: z.string().optional(),
  expectedDelivery: z.string().optional(),
  lineItems: z.array(z.object({
    description: z.string().min(1),
    quantity: z.coerce.number().positive(),
    unitPrice: z.coerce.number().nonnegative(),
    supplierId: z.string().optional(),
    glAccount: z.string().optional(),
  })).min(1),
});

export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: "Forbidden — procurement or admin role required" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const d = parsed.data;

  // If converting from an approved requisition, verify it's approvable
  if (d.requisitionId) {
    const req_ = await prisma.requisition.findUnique({ where: { id: d.requisitionId } });
    if (!req_ || req_.organizationId !== organization.id)
      return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
    if (req_.status !== "APPROVED")
      return NextResponse.json({ error: "Requisition must be in APPROVED status to create a PO" }, { status: 422 });
  }

  const lineItems = d.lineItems.map(li => ({
    description: li.description,
    quantity: li.quantity,
    unitPrice: li.unitPrice,
    lineTotal: li.quantity * li.unitPrice,
    supplierId: li.supplierId,
    glAccount: li.glAccount,
  }));

  const subtotal = lineItems.reduce((sum, li) => sum + li.lineTotal, 0);
  const poNumber = await generatePONumber(organization.id);

  const po = await prisma.purchaseOrder.create({
    data: {
      organizationId: organization.id,
      poNumber,
      requisitionId: d.requisitionId,
      supplierId: d.supplierId,
      createdById: profile.id,
      routingMethod: d.routingMethod,
      supplierEmail: d.supplierEmail,
      cxmlEndpoint: d.cxmlEndpoint,
      currency: d.currency,
      paymentTerms: d.paymentTerms,
      deliveryAddress: d.deliveryAddress,
      notes: d.notes,
      expectedDelivery: d.expectedDelivery ? new Date(d.expectedDelivery) : null,
      subtotal,
      taxAmount: 0,
      totalAmount: subtotal,
      lineItems: { create: lineItems },
    },
    include: { lineItems: true, supplier: true },
  });

  // If from a requisition, mark it as PO_CREATED
  if (d.requisitionId) {
    await prisma.requisition.update({
      where: { id: d.requisitionId },
      data: { status: "PO_CREATED" },
    });
  }

  return NextResponse.json({ purchaseOrder: po }, { status: 201 });
}
