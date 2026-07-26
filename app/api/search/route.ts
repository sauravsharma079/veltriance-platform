import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !organization || profile.organizationId !== organization.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = organization.id;

  const [requisitions, suppliers, purchaseOrders] = await Promise.all([
    prisma.requisition.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { requisitionNumber: { contains: q, mode: "insensitive" } },
          { category: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, requisitionNumber: true, title: true, status: true, totalAmount: true, currency: true },
      take: 5,
    }),
    prisma.supplier.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { category: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, category: true, status: true, preferred: true },
      take: 5,
    }),
    prisma.purchaseOrder.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { poNumber: { contains: q, mode: "insensitive" } },
          { supplier: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      select: { id: true, poNumber: true, status: true, totalAmount: true, currency: true, supplier: { select: { name: true } } },
      take: 3,
    }),
  ]);

  return NextResponse.json({
    results: [
      ...requisitions.map(r => ({ type: "requisition", id: r.id, title: r.title, sub: r.requisitionNumber, status: r.status, href: `/dashboard/requisitions/${r.id}` })),
      ...suppliers.map(s => ({ type: "supplier", id: s.id, title: s.name, sub: s.category ?? "Supplier", status: s.status, href: `/dashboard/suppliers/${s.id}` })),
      ...purchaseOrders.map(p => ({ type: "po", id: p.id, title: p.poNumber, sub: p.supplier?.name ?? "Purchase Order", status: p.status, href: `/dashboard/purchase-orders/${p.id}` })),
    ],
  });
}
