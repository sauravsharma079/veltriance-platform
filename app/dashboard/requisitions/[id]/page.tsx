"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, X, Clock } from "lucide-react";

type Requisition = {
  id: string;
  requisitionNumber: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  currency: string;
  totalAmount: string;
  costCenter: string | null;
  deliveryLocation: string | null;
  requiredDate: string | null;
  intakeSource: string;
  requestor: { name: string; email: string; department: string | null };
  lineItems: { id: string; description: string; quantity: string; unitPrice: string; lineTotal: string; supplier: { name: string } | null }[];
  approvalSteps: { id: string; stepType: string; sequence: number; status: string; comment: string | null; approver: { name: string } | null }[];
};

export default function RequisitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [req, setReq] = useState<Requisition | null>(null);
  const [canAct, setCanAct] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [comment, setComment] = useState("");

  const load = useCallback(() => {
    fetch(`/api/requisitions/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setReq(d.requisition);
        setCanAct(d.canAct ?? false);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function act(decision: "APPROVE" | "REJECT") {
    setActing(true);
    const res = await fetch(`/api/requisitions/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, comment }),
    });
    setActing(false);
    if (res.ok) {
      setComment("");
      load();
      router.refresh();
    }
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;
  if (!req) return <div className="p-8 text-sm text-gray-400">Requisition not found.</div>;

  const pendingStep = req.approvalSteps.find((s) => s.status === "PENDING");

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/dashboard/requisitions" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft className="size-3.5" /> Back to requisitions
      </Link>

      <div className="flex items-start justify-between mb-1">
        <h1 className="text-xl font-semibold text-gray-900">{req.title}</h1>
        <span className="text-xs font-mono text-gray-400">{req.requisitionNumber}</span>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Requested by {req.requestor.name} · {req.requestor.department ?? "—"} · via {req.intakeSource === "CHATBOT" ? "AI Assistant" : "Form"}
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <InfoCard label="Category" value={req.category} />
        <InfoCard label="Total amount" value={`${req.currency} ${Number(req.totalAmount).toLocaleString()}`} />
        <InfoCard label="Cost center" value={req.costCenter} />
        <InfoCard label="Delivery location" value={req.deliveryLocation} />
      </div>

      {req.description && (
        <div className="mb-6">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Description</p>
          <p className="text-sm text-gray-700">{req.description}</p>
        </div>
      )}

      <div className="mb-6">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Line items</p>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 font-medium">Qty</th>
                <th className="px-4 py-2.5 font-medium">Unit price</th>
                <th className="px-4 py-2.5 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {req.lineItems.map((li) => (
                <tr key={li.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5 text-gray-700">{li.description}</td>
                  <td className="px-4 py-2.5 text-gray-500">{li.quantity}</td>
                  <td className="px-4 py-2.5 text-gray-500">{Number(li.unitPrice).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-gray-700">{Number(li.lineTotal).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Approval timeline</p>
        <div className="space-y-2">
          {req.approvalSteps.map((s) => (
            <div key={s.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
              <StepIcon status={s.status} />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{s.stepType.charAt(0) + s.stepType.slice(1).toLowerCase()}</p>
                {s.approver && <p className="text-xs text-gray-400">{s.approver.name}</p>}
                {s.comment && <p className="text-xs text-gray-500 mt-0.5">&quot;{s.comment}&quot;</p>}
              </div>
              <span className="text-xs text-gray-400 capitalize">{s.status.toLowerCase()}</span>
            </div>
          ))}
        </div>
      </div>

      {pendingStep && canAct && (
        <div className="bg-white border border-[#C8A04D]/30 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-800 mb-3">Your decision on this {pendingStep.stepType.toLowerCase()} step</p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional comment…"
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-[#1A2A52] focus:ring-1 focus:ring-[#1A2A52] resize-none mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={() => act("APPROVE")}
              disabled={acting}
              className="flex items-center gap-1.5 bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Check className="size-4" /> Approve
            </button>
            <button
              onClick={() => act("REJECT")}
              disabled={acting}
              className="flex items-center gap-1.5 bg-white border border-red-200 text-red-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <X className="size-4" /> Reject
            </button>
          </div>
        </div>
      )}

      {pendingStep && !canAct && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-500">
          Waiting on {pendingStep.stepType.toLowerCase()} approval — this isn&apos;t your step to act on.
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value || "—"}</p>
    </div>
  );
}

function StepIcon({ status }: { status: string }) {
  if (status === "APPROVED") return <Check className="size-4 text-green-600 shrink-0" />;
  if (status === "REJECTED") return <X className="size-4 text-red-600 shrink-0" />;
  if (status === "PENDING") return <Clock className="size-4 text-amber-500 shrink-0" />;
  return <div className="size-4 rounded-full bg-gray-200 shrink-0" />;
}
