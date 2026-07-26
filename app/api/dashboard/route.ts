import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

export async function GET() {
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
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const last6Months = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    requisitions,
    pendingApprovals,
    myPendingApprovals,
    activeSuppliers,
    pendingSuppliers,
    purchaseOrders,
    recentRequisitions,
    recentApprovals,
  ] = await Promise.all([
    prisma.requisition.findMany({
      where: { organizationId: orgId },
      select: { status: true, totalAmount: true, category: true, createdAt: true, currency: true },
    }),
    prisma.approvalStep.count({
      where: { status: "PENDING", requisition: { organizationId: orgId } },
    }),
    prisma.approvalStep.count({
      where: {
        status: "PENDING",
        approverId: profile.id,
        requisition: { organizationId: orgId },
      },
    }),
    prisma.supplier.count({ where: { organizationId: orgId, status: "ACTIVE" } }),
    prisma.supplier.count({ where: { organizationId: orgId, status: "PENDING_APPROVAL" } }),
    prisma.purchaseOrder.findMany({
      where: { organizationId: orgId },
      select: { status: true, totalAmount: true, createdAt: true },
    }),
    prisma.requisition.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true, requisitionNumber: true, title: true, status: true,
        totalAmount: true, currency: true, createdAt: true,
        requestor: { select: { name: true } },
      },
    }),
    prisma.approvalStep.findMany({
      where: { requisition: { organizationId: orgId }, status: { in: ["APPROVED", "REJECTED"] } },
      orderBy: { decidedAt: "desc" },
      take: 5,
      select: {
        status: true, decidedAt: true, stepType: true,
        approver: { select: { name: true } },
        requisition: { select: { requisitionNumber: true, title: true } },
      },
    }),
  ]);

  // ── Spend by month (last 6 months) ──────────────────────────────────────────
  const monthlySpend: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
    monthlySpend[label] = 0;
  }
  requisitions.forEach(r => {
    if (r.createdAt >= last6Months) {
      const label = new Date(r.createdAt).toLocaleString("default", { month: "short", year: "2-digit" });
      if (monthlySpend[label] !== undefined) {
        monthlySpend[label] += Number(r.totalAmount);
      }
    }
  });
  const spendTrend = Object.entries(monthlySpend).map(([month, amount]) => ({ month, amount }));

  // ── Category distribution ────────────────────────────────────────────────────
  const catMap: Record<string, number> = {};
  requisitions.forEach(r => {
    const cat = r.category ?? "Uncategorized";
    catMap[cat] = (catMap[cat] ?? 0) + Number(r.totalAmount);
  });
  const categoryBreakdown = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));

  // ── Status breakdown ─────────────────────────────────────────────────────────
  const statusMap: Record<string, number> = {};
  requisitions.forEach(r => {
    statusMap[r.status] = (statusMap[r.status] ?? 0) + 1;
  });

  // ── Key metrics ──────────────────────────────────────────────────────────────
  const totalSpend = requisitions.reduce((s, r) => s + Number(r.totalAmount), 0);
  const thisMonthSpend = requisitions
    .filter(r => r.createdAt >= startOfMonth)
    .reduce((s, r) => s + Number(r.totalAmount), 0);
  const approvedCount = requisitions.filter(r => r.status === "APPROVED").length;
  const poCount = purchaseOrders.length;
  const poConversionRate = requisitions.length > 0
    ? Math.round((poCount / requisitions.length) * 100)
    : 0;

  return NextResponse.json({
    metrics: {
      totalSpend,
      thisMonthSpend,
      activeRequisitions: requisitions.filter(r =>
        !["APPROVED", "REJECTED", "CANCELLED"].includes(r.status)
      ).length,
      pendingApprovals,
      myPendingApprovals,
      approvedThisMonth: requisitions.filter(r =>
        r.status === "APPROVED" && r.createdAt >= startOfMonth
      ).length,
      poConversionRate,
      activeSuppliers,
      pendingSuppliers,
      totalRequisitions: requisitions.length,
    },
    spendTrend,
    categoryBreakdown,
    statusBreakdown: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
    recentRequisitions,
    recentApprovals,
  });
}
