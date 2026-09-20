import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApprovalStepType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasModule } from "@/lib/licensing";
import { activeDelegators } from "@/lib/approval-delegation";
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

  const covering = await activeDelegators(profile.id);
  const [pendingSteps, myRecentApprovals, statusChanges] = await Promise.all([
    // Approvals waiting on this user
    prisma.approvalStep.findMany({
      where: {
        status: "PENDING",
        requisition: { organizationId: orgId },
        OR: [
          { approverId: profile.id },
          ...(covering.length ? [{ approverId: { in: covering } }] : []),
          ...(profile.role === "ADMIN" ? [{}] : []),
          ...(profile.role === "PROCUREMENT" ? [{ stepType: { in: ["DIRECTOR","PROCUREMENT"] as ApprovalStepType[] } }] : []),
        ],
      },
      include: { requisition: { select: { id: true, title: true, requisitionNumber: true, totalAmount: true, currency: true } } },
      orderBy: { createdAt: "asc" },
      take: 10,
    }),
    // My requisitions that got approved/rejected recently
    prisma.approvalStep.findMany({
      where: {
        status: { in: ["APPROVED","REJECTED"] },
        decidedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        requisition: { organizationId: orgId, requestorId: profile.id },
      },
      include: { requisition: { select: { id: true, title: true, requisitionNumber: true } } },
      orderBy: { decidedAt: "desc" },
      take: 5,
    }),
    // Suppliers pending review (procurement/admin only)
    profile.role === "PROCUREMENT" || profile.role === "ADMIN"
      ? prisma.supplier.count({ where: { organizationId: orgId, status: "PENDING_APPROVAL" } })
      : Promise.resolve(0),
  ]);

  type Notification = {
    id: string;
    type: string;
    title: string;
    body: string;
    href: string;
    urgent: boolean;
    createdAt: string;
  };

  // Contracts approaching their renewal / notice deadline (only orgs licensed for Contracts).
  const contractAlerts: Notification[] = [];
  if ((profile.role === "PROCUREMENT" || profile.role === "ADMIN") && hasModule(organization, "CONTRACTS")) {
    const soon = await prisma.contract.findMany({
      where: { organizationId: orgId, status: "ACTIVE", endDate: { not: null, lte: new Date(Date.now() + 120 * 86_400_000) } },
      select: { id: true, title: true, contractNumber: true, endDate: true, noticeDays: true }, orderBy: { endDate: "asc" }, take: 20,
    });
    for (const c of soon) {
      const days = Math.ceil((c.endDate!.getTime() - Date.now()) / 86_400_000);
      if (days > c.noticeDays + 30) continue;
      contractAlerts.push({
        id: `contract-${c.id}`, type: "contract_renewal",
        title: days < 0 ? "Contract has ended" : `Contract ends in ${days} day${days === 1 ? "" : "s"}`,
        body: `${c.contractNumber} — ${c.title}`, href: `/dashboard/contracts/${c.id}`,
        urgent: days <= c.noticeDays, createdAt: new Date().toISOString(),
      });
    }
  }

  // Contracts waiting on this person: named as the approver, or (if none was named) any eligible approver.
  const contractApprovals: Notification[] = [];
  if (["ADMIN", "PROCUREMENT", "APPROVER"].includes(profile.role) && hasModule(organization, "CONTRACTS")) {
    const waiting = await prisma.contract.findMany({
      where: { organizationId: orgId, status: "PENDING_APPROVAL", ownerId: { not: profile.id }, OR: [{ approverId: profile.id }, { approverId: null }] },
      select: { id: true, title: true, contractNumber: true, updatedAt: true }, orderBy: { updatedAt: "asc" }, take: 20,
    });
    for (const c of waiting) contractApprovals.push({
      id: `contract-approval-${c.id}`, type: "contract_approval", title: "Contract awaiting your approval",
      body: `${c.contractNumber} — ${c.title}`, href: `/dashboard/contracts/${c.id}`, urgent: true, createdAt: c.updatedAt.toISOString(),
    });
  }

  // New vendors who've finished their onboarding and are waiting for someone to review and approve.
  const vendorReviews: Notification[] = [];
  if (profile.role === "PROCUREMENT" || profile.role === "ADMIN") {
    const ready = await prisma.supplier.findMany({ where: { organizationId: orgId, status: "PENDING_APPROVAL", portalSubmittedAt: { not: null } }, select: { id: true, name: true, portalSubmittedAt: true }, orderBy: { portalSubmittedAt: "asc" }, take: 20 });
    for (const v of ready) vendorReviews.push({ id: `vendor-review-${v.id}`, type: "vendor_review", title: "Vendor ready for review", body: `${v.name} has completed onboarding`, href: `/dashboard/suppliers/${v.id}`, urgent: true, createdAt: v.portalSubmittedAt!.toISOString() });
  }

  // Invoices needing a decision, and deliveries that should have arrived by now.
  const invoiceAlerts: Notification[] = [];
  if ((profile.role === "PROCUREMENT" || profile.role === "ADMIN") && hasModule(organization, "INVOICING")) {
    const [exc, waiting] = await Promise.all([
      prisma.invoice.count({ where: { organizationId: orgId, status: "EXCEPTION" } }),
      prisma.invoice.count({ where: { organizationId: orgId, status: "MATCHED", createdById: { not: profile.id } } }),
    ]);
    if (exc > 0) invoiceAlerts.push({ id: "invoice-exceptions", type: "invoice_exception", title: `${exc} invoice${exc > 1 ? "s" : ""} with exceptions`, body: "Failed the three-way match — needs a decision", href: "/dashboard/invoices?status=EXCEPTION", urgent: true, createdAt: new Date().toISOString() });
    if (waiting > 0) invoiceAlerts.push({ id: "invoice-approvals", type: "invoice_approval", title: `${waiting} invoice${waiting > 1 ? "s" : ""} awaiting approval`, body: "Matched cleanly — ready for your approval", href: "/dashboard/invoices?status=MATCHED", urgent: true, createdAt: new Date().toISOString() });
  }
  if (hasModule(organization, "INTAKE_TO_PO")) {
    const late = await prisma.purchaseOrder.findMany({
      where: { organizationId: orgId, status: { in: ["SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED"] }, expectedDelivery: { lt: new Date(Date.now() - 86_400_000) },
        ...(profile.role === "PROCUREMENT" || profile.role === "ADMIN" ? {} : { createdById: profile.id }) },
      select: { id: true, poNumber: true, expectedDelivery: true, supplier: { select: { name: true } } }, orderBy: { expectedDelivery: "asc" }, take: 10,
    });
    for (const p of late) invoiceAlerts.push({ id: `late-${p.id}`, type: "delivery_overdue", title: "Delivery overdue", body: `${p.poNumber}${p.supplier ? ` — ${p.supplier.name}` : ""} was due ${p.expectedDelivery!.toLocaleDateString()}`, href: `/dashboard/purchase-orders/${p.id}`, urgent: false, createdAt: p.expectedDelivery!.toISOString() });
  }

  const notifications: Notification[] = [
    ...invoiceAlerts,
    ...vendorReviews,
    ...contractApprovals,
    ...contractAlerts,
    ...pendingSteps.map(s => ({
      id: `approval-${s.id}`,
      type: "approval_needed",
      title: "Approval required",
      body: `${s.requisition.requisitionNumber} — ${s.requisition.title}`,
      href: `/dashboard/requisitions/${s.requisition.id}`,
      urgent: true,
      createdAt: s.createdAt.toISOString(),
    })),
    ...myRecentApprovals.map(s => ({
      id: `decided-${s.id}`,
      type: s.status === "APPROVED" ? "approved" : "rejected",
      title: s.status === "APPROVED" ? "Request approved" : "Request rejected",
      body: `${s.requisition.requisitionNumber} — ${s.requisition.title}`,
      href: `/dashboard/requisitions/${s.requisition.id}`,
      urgent: false,
      createdAt: (s.decidedAt ?? s.createdAt).toISOString(),
    })),
    ...((statusChanges as number) > 0 ? [{
      id: "pending-suppliers",
      type: "suppliers",
      title: `${statusChanges} supplier${(statusChanges as number) > 1 ? "s" : ""} awaiting review`,
      body: "New supplier requests need your approval",
      href: "/dashboard/admin",
      urgent: true,
      createdAt: new Date().toISOString(),
    }] : []),
  ];

  return NextResponse.json({
    notifications,
    unreadCount: notifications.filter(n => n.urgent).length,
  });
}
