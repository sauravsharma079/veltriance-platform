"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart, ExternalLink } from "lucide-react";

type PO = {
  id: string; poNumber: string; status: string; currency: string;
  totalAmount: string; routingMethod: string; issuedAt: string | null;
  createdAt: string;
  supplier: { name: string } | null;
  requisition: { requisitionNumber: string; title: string } | null;
  createdBy: { name: string };
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-500",
  SENT: "bg-blue-50 text-blue-700",
  ACKNOWLEDGED: "bg-indigo-50 text-indigo-700",
  PARTIALLY_RECEIVED: "bg-amber-50 text-amber-700",
  RECEIVED: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
  CLOSED: "bg-gray-100 text-gray-500",
};

const METHOD_LABEL: Record<string, string> = {
  EMAIL: "✉️ Email", CXML: "⚡ cXML", MANUAL: "📋 Manual",
};

export default function PurchaseOrdersPage() {
  const [pos, setPos] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/purchase-orders${status ? `?status=${status}` : ""}`)
      .then(r => r.json())
      .then(d => setPos(d.purchaseOrders ?? []))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-1">
            POs are created automatically when a requisition is fully approved. Open one to route it to your supplier.
          </p>
        </div>
        <div className="flex gap-2">
          {["", "DRAFT", "SENT", "ACKNOWLEDGED", "RECEIVED"].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${status === s ? "bg-[#1A2A52] text-white border-[#1A2A52]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-400 px-5 py-8 text-center">Loading…</p>
        ) : pos.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <ShoppingCart className="size-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No purchase orders yet.</p>
            <p className="text-xs text-gray-400 mt-1">
              POs appear here automatically once a requisition completes all approval steps.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">PO Number</th>
                <th className="px-5 py-3 font-medium">Supplier</th>
                <th className="px-5 py-3 font-medium">Requisition</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Routing</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {pos.map(po => (
                <tr key={po.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-5 py-3.5 font-medium text-[#1A2A52]">{po.poNumber}</td>
                  <td className="px-5 py-3.5 text-gray-700">{po.supplier?.name ?? <span className="text-gray-400 italic">No supplier set</span>}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">{po.requisition?.requisitionNumber ?? "—"}</td>
                  <td className="px-5 py-3.5 text-gray-700">{po.currency} {Number(po.totalAmount).toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">{METHOD_LABEL[po.routingMethod] ?? po.routingMethod}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[po.status] ?? ""}`}>
                      {po.status.replace(/_/g, " ").toLowerCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <Link href={`/dashboard/purchase-orders/${po.id}`}
                      className="inline-flex items-center gap-1 text-xs text-[#1A2A52] hover:underline font-medium">
                      {po.status === "DRAFT" ? "Review & Send" : "View"} <ExternalLink className="size-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
