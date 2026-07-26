"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, CheckCircle, Mail, Clipboard, Download } from "lucide-react";

type PO = {
  id: string;
  poNumber: string;
  status: string;
  routingMethod: string;
  currency: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  paymentTerms: string | null;
  deliveryAddress: string | null;
  notes: string | null;
  supplierEmail: string | null;
  cxmlEndpoint: string | null;
  issuedAt: string | null;
  acknowledgedAt: string | null;
  expectedDelivery: string | null;
  createdAt: string;
  supplier: { id: string; name: string; contactEmail: string | null; contactName: string | null } | null;
  requisition: { requisitionNumber: string; title: string } | null;
  createdBy: { name: string; email: string };
  lineItems: { id: string; description: string; quantity: string; unitPrice: string; lineTotal: string; glAccount: string | null }[];
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SENT: "bg-blue-50 text-blue-700",
  ACKNOWLEDGED: "bg-indigo-50 text-indigo-700",
  PARTIALLY_RECEIVED: "bg-amber-50 text-amber-700",
  RECEIVED: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
  CLOSED: "bg-gray-100 text-gray-500",
};

export default function PODetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [po, setPo] = useState<PO | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [overrideEmail, setOverrideEmail] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPaymentTerms, setEditPaymentTerms] = useState("");
  const [editDelivery, setEditDelivery] = useState("");
  const [editSupplierId, setEditSupplierId] = useState("");
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; contactEmail: string | null }[]>([]);

  const load = useCallback(() => {
    fetch(`/api/purchase-orders/${id}`)
      .then(r => r.json())
      .then(d => {
        setPo(d.purchaseOrder);
        setEditNotes(d.purchaseOrder?.notes ?? "");
        setEditPaymentTerms(d.purchaseOrder?.paymentTerms ?? "");
        setEditDelivery(d.purchaseOrder?.deliveryAddress ?? "");
        setEditSupplierId(d.purchaseOrder?.supplierId ?? "");
        setOverrideEmail(d.purchaseOrder?.supplierEmail ?? d.purchaseOrder?.supplier?.contactEmail ?? "");
        setLoading(false);
      });
    fetch("/api/suppliers?status=ACTIVE")
      .then(r => r.json())
      .then(d => setSuppliers(d.suppliers ?? []));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/purchase-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId: editSupplierId || undefined,
        supplierEmail: overrideEmail || undefined,
        notes: editNotes || undefined,
        paymentTerms: editPaymentTerms || undefined,
        deliveryAddress: editDelivery || undefined,
      }),
    });
    setSaving(false);
    load();
  }

  async function handleSend(method: "EMAIL" | "MANUAL") {
    setSending(true);
    setSendError(null);
    setSendSuccess(null);
    const body: Record<string, string> = { method };
    if (method === "EMAIL" && overrideEmail) body.supplierEmail = overrideEmail;
    const res = await fetch(`/api/purchase-orders/${id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) { setSendError(data.error ?? "Failed to send"); return; }
    setSendSuccess(data.detail);
    load();
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;
  if (!po) return <div className="p-8 text-sm text-gray-400">Purchase order not found.</div>;

  const isDraft = po.status === "DRAFT";
  const defaultEmail = po.supplierEmail ?? po.supplier?.contactEmail ?? "";

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/dashboard/purchase-orders" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft className="size-3.5" /> Back to purchase orders
      </Link>

      <div className="flex items-start justify-between mb-1">
        <h1 className="text-xl font-semibold text-gray-900">{po.poNumber}</h1>
        <div className="flex items-center gap-2">
          <a href={`/dashboard/purchase-orders/${id}/print`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium px-3.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="size-3.5" /> Download PDF
          </a>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[po.status] ?? ""}`}>
            {po.status.replace(/_/g, " ").toLowerCase()}
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Created by {po.createdBy.name}
        {po.requisition && <> · from requisition <Link href={`/dashboard/requisitions`} className="text-[#1A2A52] hover:underline">{po.requisition.requisitionNumber}</Link></>}
      </p>

      {/* Info cards — all pre-filled from requisition */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <InfoCard label="Supplier" value={po.supplier?.name ?? "—"} />
        <InfoCard label="Total amount" value={`${po.currency} ${Number(po.totalAmount).toLocaleString()}`} />
        <InfoCard label="Payment terms" value={po.paymentTerms ?? "—"} />
        <InfoCard label="Delivery address" value={po.deliveryAddress ?? "—"} />
        {po.issuedAt && <InfoCard label="Issued" value={new Date(po.issuedAt).toLocaleDateString()} />}
        {po.expectedDelivery && <InfoCard label="Expected delivery" value={new Date(po.expectedDelivery).toLocaleDateString()} />}
      </div>

      {/* For DRAFT POs: only allow editing routing details, not re-entering what came from the requisition */}
      {isDraft && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-0.5">Review before sending</p>
            <p className="text-xs text-gray-500">All details have been copied from the approved requisition. Adjust only if needed, then route to the supplier below.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Override supplier email</label>
              <input value={overrideEmail} onChange={e => setOverrideEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1A2A52] bg-white"
                placeholder={po.supplier?.contactEmail ?? "supplier@company.com"} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Override payment terms</label>
              <input value={editPaymentTerms} onChange={e => setEditPaymentTerms(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1A2A52] bg-white"
                placeholder={po.paymentTerms ?? "Net 30"} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Additional notes to supplier</label>
            <textarea rows={2} value={editNotes} onChange={e => setEditNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1A2A52] resize-none bg-white"
              placeholder={po.notes ?? "Any special instructions for this order…"} />
          </div>
          {(overrideEmail !== (po.supplierEmail ?? "") || editPaymentTerms !== (po.paymentTerms ?? "") || editNotes !== (po.notes ?? "")) && (
            <button onClick={handleSave} disabled={saving}
              className="bg-[#1A2A52] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#243766] transition-colors disabled:opacity-50">
              {saving ? "Saving…" : "Save changes"}
            </button>
          )}
        </div>
      )}

      {/* Line items */}
      <div className="mb-6">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Line items</p>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 font-medium">GL Account</th>
                <th className="px-4 py-2.5 font-medium text-right">Qty</th>
                <th className="px-4 py-2.5 font-medium text-right">Unit price</th>
                <th className="px-4 py-2.5 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {po.lineItems.map(li => (
                <tr key={li.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5 text-gray-700">{li.description}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{li.glAccount ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-right">{li.quantity}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-right">{Number(li.unitPrice).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-gray-700 text-right font-medium">{Number(li.lineTotal).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-100">
                <td colSpan={4} className="px-4 py-2.5 text-right text-sm font-semibold text-gray-800">Total</td>
                <td className="px-4 py-2.5 text-right text-sm font-semibold text-gray-800">
                  {po.currency} {Number(po.totalAmount).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Send routing panel — only shown for DRAFT POs */}
      {isDraft && (
        <div className="bg-white border border-[#C8A04D]/30 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-800 mb-4">Route this PO to supplier</p>

          <div className="grid sm:grid-cols-2 gap-3">
            {/* Email */}
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="size-4 text-[#1A2A52]" />
                <span className="text-sm font-medium text-gray-800">Send by email</span>
              </div>
              <input
                value={overrideEmail || defaultEmail}
                onChange={e => setOverrideEmail(e.target.value)}
                placeholder={defaultEmail || "supplier@example.com"}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1A2A52] mb-3"
              />
              <button
                onClick={() => handleSend("EMAIL")}
                disabled={sending}
                className="w-full flex items-center justify-center gap-1.5 bg-[#1A2A52] text-white text-sm font-medium py-2 rounded-lg hover:bg-[#243766] transition-colors disabled:opacity-50"
              >
                <Send className="size-3.5" /> Send email
              </button>
            </div>

            {/* Manual */}
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clipboard className="size-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-800">Mark as sent manually</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Use this if you sent the PO as a PDF outside the system — this updates the status so it can be tracked.
              </p>
              <button
                onClick={() => handleSend("MANUAL")}
                disabled={sending}
                className="w-full flex items-center justify-center gap-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <Clipboard className="size-3.5" /> Mark as sent
              </button>
            </div>
          </div>

          {sendError && <p className="text-xs text-red-600 mt-3">{sendError}</p>}
          {sendSuccess && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 mt-3 text-sm">
              <CheckCircle className="size-4" /> {sendSuccess}
            </div>
          )}
        </div>
      )}

      {!isDraft && po.issuedAt && (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
          <CheckCircle className="size-4" />
          PO sent {po.routingMethod === "EMAIL" ? "by email" : "manually"} on {new Date(po.issuedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
  );
}
