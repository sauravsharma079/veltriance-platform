import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getMemberOrganization } from "@/lib/tenant";
import { purchaseOrderScope } from "@/lib/permissions";
import { errorMessage } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ purchaseOrders: [] });
    const org = await getMemberOrganization(user.id);
    if (!org) return NextResponse.json({ purchaseOrders: [] });
    const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("limit") ?? "200") || 200, 1), 500);
    const scope = await purchaseOrderScope(user.id, org.id);
    if (!scope) return NextResponse.json({ purchaseOrders: [] });
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { organizationId: org.id, ...scope },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        supplier: { select: { name: true, code: true, contactEmail: true } },
        requisition: { select: { requisitionNumber: true, title: true } },
        lineItems: { select: { glAccount: true, lineTotal: true, description: true } },
      },
    });
    // Normalize field names for both dashboard and list page
    const normalized = purchaseOrders.map(po => ({
      ...po,
      totalAmount: Number((po as any).totalAmount ?? 0),
      subtotal: Number((po as any).subtotal ?? 0),
      totalTax: Number((po as any).totalTax ?? 0),
      deliveryAddress: (po as any).deliveryLocation ?? (po as any).deliveryAddress ?? null,
    }));
    return NextResponse.json({ purchaseOrders: normalized });
  } catch (e) {
    console.error("[purchase-orders GET]", errorMessage(e));
    return NextResponse.json({ purchaseOrders: [] });
  }
}
