import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { CheckSquare } from "lucide-react";

export default async function ApprovalsPage() {
  const result = await getCurrentUser();
  if (!result || !result.profile) redirect("/login");
  const { profile, organization } = result;

  const pendingSteps = await prisma.approvalStep.findMany({
    where: {
      status: "PENDING",
      requisition: { organizationId: organization.id },
      OR: [
        { approverId: profile!.id },
        ...(profile!.role === "PROCUREMENT" ? [{ stepType: { in: ["DIRECTOR", "PROCUREMENT"] as const } }] : []),
        ...(profile!.role === "ADMIN" ? [{ stepType: { in: ["DIRECTOR", "PROCUREMENT", "FINANCE"] as const } }] : []),
      ],
    },
    include: {
      requisition: { include: { requestor: { select: { name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-xl font-semibold text-gray-900">My approvals</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">Requisitions waiting on your decision.</p>

      {pendingSteps.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-10 text-center">
          <CheckSquare className="size-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Nothing pending your approval right now.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-50">
          {pendingSteps.map((step) => (
            <Link
              key={step.id}
              href={`/dashboard/requisitions/${step.requisition.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/60 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{step.requisition.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {step.requisition.requisitionNumber} · {step.requisition.requestor.name} · {step.stepType.toLowerCase()} approval
                </p>
              </div>
              <span className="text-sm font-medium text-gray-700">
                {step.requisition.currency} {Number(step.requisition.totalAmount).toLocaleString()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
