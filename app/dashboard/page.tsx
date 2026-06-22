import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { MessageSquarePlus, FileText, CheckSquare, Building2 } from "lucide-react";

export default async function DashboardPage() {
  const { profile, organization } = (await getCurrentUser())!;

  const [myRequisitions, pendingApprovals, pendingSuppliers] = await Promise.all([
    prisma.requisition.count({ where: { organizationId: organization.id, requestorId: profile!.id } }),
    profile!.role !== "REQUESTOR"
      ? prisma.approvalStep.count({ where: { approverId: profile!.id, status: "PENDING", requisition: { organizationId: organization.id } } })
      : Promise.resolve(0),
    profile!.role === "PROCUREMENT" || profile!.role === "ADMIN"
      ? prisma.supplier.count({ where: { organizationId: organization.id, status: "PENDING_APPROVAL" } })
      : Promise.resolve(0),
  ]);

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-xl font-semibold text-gray-900">Welcome back, {profile!.name.split(" ")[0]}</h1>
      <p className="text-sm text-gray-500 mt-1">Here&apos;s what&apos;s happening with your requests.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <StatCard label="My Requisitions" value={myRequisitions} icon={FileText} />
        {profile!.role !== "REQUESTOR" && (
          <StatCard label="Pending My Approval" value={pendingApprovals} icon={CheckSquare} highlight={pendingApprovals > 0} />
        )}
        {(profile!.role === "PROCUREMENT" || profile!.role === "ADMIN") && (
          <StatCard label="Suppliers Awaiting Review" value={pendingSuppliers} icon={Building2} highlight={pendingSuppliers > 0} />
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/intake"
            className="flex items-center gap-2 bg-[#1A2A52] text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-[#243766] transition-colors"
          >
            <MessageSquarePlus className="size-4" />
            Submit a new request
          </Link>
          <Link
            href="/dashboard/requisitions"
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileText className="size-4" />
            View my requisitions
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: number;
  icon: typeof FileText;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-5 bg-white ${highlight ? "border-[#C8A04D]/40" : "border-gray-200"}`}>
      <div className="flex items-center justify-between">
        <Icon className={`size-5 ${highlight ? "text-[#C8A04D]" : "text-gray-400"}`} />
        {highlight && <span className="size-2 rounded-full bg-[#C8A04D]" />}
      </div>
      <p className="text-2xl font-semibold text-gray-900 mt-3">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
