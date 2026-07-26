import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      createdBy: { select: { name: true, email: true } },
      requisition: { select: { requisitionNumber: true, title: true } },
      lineItems: { include: { supplier: { select: { name: true } } } },
    },
  });

  if (!po || po.organizationId !== organization.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ purchaseOrder: po });
}

const updateSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED", "CLOSED"]).optional(),
  notes: z.string().optional(),
  expectedDelivery: z.string().optional(),
  paymentTerms: z.string().optional(),
  supplierEmail: z.string().email().optional(),
  supplierId: z.string().optional(),
  deliveryAddress: z.string().optional(),
  cxmlEndpoint: z.string().url().optional(),
  routingMethod: z.enum(["EMAIL", "CXML", "MANUAL"]).optional(),
  chartOfAccountId: z.string().optional().nullable(),
  glCoding: z.record(z.string()).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== organization.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.expectedDelivery) data.expectedDelivery = new Date(parsed.data.expectedDelivery);

  const po = await prisma.purchaseOrder.update({ where: { id }, data });
  return NextResponse.json({ purchaseOrder: po });
}
