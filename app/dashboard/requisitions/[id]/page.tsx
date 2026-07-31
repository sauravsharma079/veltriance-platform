"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, X, Clock, ShoppingCart, Send } from "lucide-react";

type Requisition = {
  id: string;
  requisitionNumber: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: string | null;
  status: string;
  currency: string;
  totalAmount: string;
  taxAmount: string | null;
  businessUnit: string | null;
  department: string | null;
  project: string | null;
  deliveryLocation: string | null;
  requiredDate: string | null;
  businessJustification: string | null;
  customFieldAnswers: Record<string, string | number | boolean> | null;
  intakeSource: string;
  requestor: { name: string; email: string; department: string | null };
  lineItems: {
    id: string; description: string; quantity: string; unitPrice: string; lineTotal: string;
    taxRate: string | null; glAccount: string | null; costCenter: string | null;
    contractReference: string | null; glCoding: Record<string, string> | null;
    supplier: { name: string } | null;
  }[];
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
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

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

  async function submitForApproval() {
    setSubmitting(true); setSubmitError("");
    const res = await fetch(`/api/requisitions/${id}/submit`, { method: "POST" });
    const d = await res.json();
    setSubmitting(false);
    if (!res.ok) { setSubmitError(d.error || "Failed to submit"); return; }
    load();
    router.refresh();
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
        <InfoCard label="Delivery location" value={req.deliveryLocation} />
        <InfoCard label="Required by" value={req.requiredDate ? new Date(req.requiredDate).toLocaleDateString() : null} />
        {req.businessUnit && <InfoCard label="Business unit" value={req.businessUnit} />}
        {req.department && <InfoCard label="Department" value={req.department} />}
      </div>

      {req.customFieldAnswers && Object.keys(req.customFieldAnswers).length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Category details{req.category ? ` (${req.category})` : ""}</p>
          <div className="bg-white border border-gray-200 rounded-xl p-4 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {Object.entries(req.customFieldAnswers).map(([key, value]) => (
              <div key={key} className="flex items-baseline justify-between gap-4 py-1 border-b border-gray-50 last:border-0">
                <span className="text-gray-500 shrink-0 capitalize">{key.replace(/_/g, " ")}</span>
                <span className="font-medium text-gray-800 text-right truncate">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ... status banners ... */}
      {req.status === "DRAFT" && (
        <div className="mb-6 bg-white border border-[#C8A04D]/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">
              {req.intakeSource === "PUNCHOUT" ? "Review this punchout cart before submitting it for approval." : "This request is still a draft."}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Check the line items below, then submit to start the approval chain.</p>
            {submitError && <p className="text-xs text-red-600 mt-1">{submitError}</p>}
          </div>
          <button onClick={submitForApproval} disabled={submitting}
            className="flex items-center gap-1.5 bg-[#1A2A52] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#243766] transition-colors disabled:opacity-50 shrink-0">
            <Send className="size-4" /> {submitting ? "Submitting…" : "Submit for Approval"}
          </button>
        </div>
      )}

      {req.status === "APPROVED" && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-800">All approvals complete</p>
            <p className="text-xs text-green-600 mt-0.5">A Purchase Order draft has been created automatically — go to the PO module to review and send it to the supplier.</p>
          </div>
          <Link href="/dashboard/purchase-orders"
            className="flex items-center gap-1.5 bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-800 transition-colors shrink-0">
            <ShoppingCart className="size-4" /> View PO
          </Link>
        </div>
      )}

      {req.status === "PO_CREATED" && (
        <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-800">Purchase order issued</p>
            <p className="text-xs text-indigo-600 mt-0.5">This requisition has been converted to a PO and sent to the supplier.</p>
          </div>
          <Link href="/dashboard/purchase-orders"
            className="flex items-center gap-1.5 bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-800 transition-colors shrink-0">
            <ShoppingCart className="size-4" /> View PO
          </Link>
        </div>
      )}

      {/* Line items — showing supplier, cost center, and GL coding per line */}
      <div className="mb-6">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Line items</p>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 font-medium">Supplier</th>
                <th className="px-4 py-2.5 font-medium">GL account</th>
                <th className="px-4 py-2.5 font-medium text-right">Qty</th>
                <th className="px-4 py-2.5 font-medium text-right">Unit price</th>
                <th className="px-4 py-2.5 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {req.lineItems.map((li) => {
                const glString = li.glCoding ? Object.values(li.glCoding).join(" - ") : li.glAccount;
                return (
                  <tr key={li.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-2.5 text-gray-800 font-medium">{li.description}</td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs">{li.supplier?.name ?? <span className="text-red-400">Not set</span>}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {glString ? (
                        <span className="font-mono text-[#1A2A52] bg-[#1A2A52]/5 px-1.5 py-0.5 rounded">{glString}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-right">{li.quantity}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-right">{Number(li.unitPrice).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-gray-800 font-medium text-right">{req.currency} {Number(li.lineTotal).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-100">
                <td colSpan={6} className="px-4 py-2.5 text-right text-sm font-semibold text-gray-800">Total</td>
                <td className="px-4 py-2.5 text-right text-sm font-semibold text-gray-800">
                  {req.currency} {Number(req.totalAmount).toLocaleString()}
                </td>
              </tr>
            </tfoot>
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
