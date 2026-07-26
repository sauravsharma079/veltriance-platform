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

  const [pendingSteps, myRecentApprovals, statusChanges] = await Promise.all([
    // Approvals waiting on this user
    prisma.approvalStep.findMany({
      where: {
        status: "PENDING",
        requisition: { organizationId: orgId },
        OR: [
          { approverId: profile.id },
          ...(profile.role === "ADMIN" ? [{}] : []),
          ...(profile.role === "PROCUREMENT" ? [{ stepType: { in: ["DIRECTOR","PROCUREMENT"] as const } }] : []),
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

  const notifications: Notification[] = [
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
