"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

type PO = {
  id: string; poNumber: string; status: string; currency: string;
  subtotal: string; taxAmount: string; totalAmount: string;
  paymentTerms: string | null; deliveryAddress: string | null;
  notes: string | null; supplierEmail: string | null;
  routingMethod: string; issuedAt: string | null; createdAt: string;
  expectedDelivery: string | null;
  supplier: { id: string; name: string; contactEmail: string | null; contactName: string | null; addressLine1: string | null; city: string | null; country: string | null } | null;
  requisition: { requisitionNumber: string; title: string; requestor: { name: string; email: string; department: string | null } | null } | null;
  createdBy: { name: string; email: string };
  lineItems: { id: string; description: string; quantity: string; unitPrice: string; lineTotal: string; glAccount: string | null; taxRate: string | null }[];
};

export default function POPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [po, setPo] = useState<PO | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch(`/api/purchase-orders/${id}`)
      .then(r => r.json())
      .then(d => { setPo(d.purchaseOrder); setLoading(false); });
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!loading && po) {
      setTimeout(() => window.print(), 300);
    }
  }, [loading, po]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-400 text-sm">Preparing document…</p>
    </div>
  );
  if (!po) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-400 text-sm">Purchase order not found.</p>
    </div>
  );

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const subtotal = Number(po.subtotal ?? po.totalAmount);
  const tax = Number(po.taxAmount ?? 0);
  const total = Number(po.totalAmount);

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 15mm 15mm; size: A4 portrait; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .page-break { page-break-after: always; }
        }
        body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
      `}</style>

      {/* Print button — hidden when printing */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button onClick={() => window.print()}
          className="bg-[#1A2A52] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#243766] shadow-lg">
          ⬇ Download / Print PDF
        </button>
        <button onClick={() => window.close()}
          className="bg-white border border-gray-200 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 shadow-lg">
          Close
        </button>
      </div>

      {/* PO Document */}
      <div className="max-w-4xl mx-auto p-10 bg-white min-h-screen">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-[#1A2A52]">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-xl bg-gradient-to-br from-[#1A2A52] to-[#C8A04D] flex items-center justify-center">
                <span className="text-white font-bold text-sm">V</span>
              </div>
              <div>
                <p className="text-xl font-bold text-[#1A2A52]">Veltriance</p>
                <p className="text-xs text-gray-500">Technology · Consulting · Managed Services</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-[#1A2A52]">PURCHASE ORDER</p>
            <p className="text-lg font-semibold text-[#C8A04D] mt-1">{po.poNumber}</p>
            <p className="text-sm text-gray-500 mt-1">Date: {today}</p>
            {po.issuedAt && <p className="text-sm text-gray-500">Issued: {new Date(po.issuedAt).toLocaleDateString()}</p>}
            <span className={`inline-block mt-2 text-xs font-semibold px-3 py-1 rounded-full ${
              po.status === "SENT" || po.status === "ACKNOWLEDGED" ? "bg-green-100 text-green-700" :
              po.status === "DRAFT" ? "bg-gray-100 text-gray-600" : "bg-blue-50 text-blue-700"
            }`}>{po.status.replace(/_/g, " ")}</span>
          </div>
        </div>

        {/* Addresses */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Bill / Ship From</p>
            <p className="font-semibold text-gray-900">Veltriance Technology Pvt. Ltd.</p>
            <p className="text-sm text-gray-600 mt-1">Prepared by: {po.createdBy.name}</p>
            <p className="text-sm text-gray-500">{po.createdBy.email}</p>
            {po.deliveryAddress && (
              <>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-4 mb-1">Deliver To</p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{po.deliveryAddress}</p>
              </>
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Supplier / Vendor</p>
            {po.supplier ? (
              <>
                <p className="font-semibold text-gray-900">{po.supplier.name}</p>
                {po.supplier.contactName && <p className="text-sm text-gray-600 mt-1">Attn: {po.supplier.contactName}</p>}
                {po.supplier.contactEmail && <p className="text-sm text-gray-500">{po.supplier.contactEmail}</p>}
                {po.supplier.addressLine1 && <p className="text-sm text-gray-600 mt-1">{po.supplier.addressLine1}</p>}
                {po.supplier.city && <p className="text-sm text-gray-600">{po.supplier.city}{po.supplier.country ? `, ${po.supplier.country}` : ""}</p>}
              </>
            ) : (
              <p className="text-sm text-gray-400 italic">No supplier assigned</p>
            )}
          </div>
        </div>

        {/* PO Details strip */}
        <div className="bg-[#1A2A52]/5 rounded-xl p-4 mb-6 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Payment terms</p>
            <p className="font-medium text-gray-800">{po.paymentTerms ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Currency</p>
            <p className="font-medium text-gray-800">{po.currency}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Expected delivery</p>
            <p className="font-medium text-gray-800">{po.expectedDelivery ? new Date(po.expectedDelivery).toLocaleDateString() : "—"}</p>
          </div>
          {po.requisition && (
            <>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Requisition ref.</p>
                <p className="font-medium text-gray-800">{po.requisition.requisitionNumber}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-0.5">Description</p>
                <p className="font-medium text-gray-800 truncate">{po.requisition.title}</p>
              </div>
            </>
          )}
        </div>

        {/* Line items table */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="bg-[#1A2A52] text-white">
              <th className="px-4 py-2.5 text-left font-semibold rounded-tl-lg">#</th>
              <th className="px-4 py-2.5 text-left font-semibold">Description</th>
              <th className="px-4 py-2.5 text-left font-semibold">GL Account</th>
              <th className="px-4 py-2.5 text-right font-semibold">Qty</th>
              <th className="px-4 py-2.5 text-right font-semibold">Unit Price</th>
              <th className="px-4 py-2.5 text-right font-semibold">Tax %</th>
              <th className="px-4 py-2.5 text-right font-semibold rounded-tr-lg">Total</th>
            </tr>
          </thead>
          <tbody>
            {po.lineItems.map((li, i) => (
              <tr key={li.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                <td className="px-4 py-2.5 text-gray-500 border-b border-gray-100">{i + 1}</td>
                <td className="px-4 py-2.5 text-gray-800 border-b border-gray-100 font-medium">{li.description}</td>
                <td className="px-4 py-2.5 text-gray-500 border-b border-gray-100 text-xs font-mono">{li.glAccount ?? "—"}</td>
                <td className="px-4 py-2.5 text-gray-700 border-b border-gray-100 text-right">{li.quantity}</td>
                <td className="px-4 py-2.5 text-gray-700 border-b border-gray-100 text-right">{po.currency} {Number(li.unitPrice).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-gray-500 border-b border-gray-100 text-right text-xs">{li.taxRate ? `${(Number(li.taxRate) * 100).toFixed(0)}%` : "0%"}</td>
                <td className="px-4 py-2.5 text-gray-800 border-b border-gray-100 text-right font-semibold">{po.currency} {Number(li.lineTotal).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={6} className="px-4 py-2 text-right text-sm text-gray-500">Subtotal</td><td className="px-4 py-2 text-right text-sm text-gray-700">{po.currency} {subtotal.toLocaleString()}</td></tr>
            <tr><td colSpan={6} className="px-4 py-2 text-right text-sm text-gray-500">Tax</td><td className="px-4 py-2 text-right text-sm text-gray-700">{po.currency} {tax.toLocaleString()}</td></tr>
            <tr className="bg-[#1A2A52]/5">
              <td colSpan={6} className="px-4 py-3 text-right font-bold text-gray-900 text-base rounded-bl-lg">TOTAL</td>
              <td className="px-4 py-3 text-right font-bold text-[#1A2A52] text-base rounded-br-lg">{po.currency} {total.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        {/* Notes */}
        {po.notes && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Notes / Special Instructions</p>
            <p className="text-sm text-amber-900">{po.notes}</p>
          </div>
        )}

        {/* Terms */}
        <div className="mb-8 p-4 bg-gray-50 rounded-xl">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Terms & Conditions</p>
          <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
            <li>All goods/services must comply with the specifications stated in this PO.</li>
            <li>Payment will be made within the agreed payment terms from receipt of a valid invoice quoting this PO number.</li>
            <li>Veltriance reserves the right to return goods that do not meet quality standards at the supplier's expense.</li>
            <li>This purchase order constitutes the entire agreement between the parties for the items listed herein.</li>
            <li>Any changes to this PO must be agreed in writing by an authorised representative of Veltriance.</li>
          </ol>
        </div>

        {/* Signature section */}
        <div className="grid grid-cols-2 gap-12 pt-6 border-t border-gray-200">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6">Authorised by (Veltriance)</p>
            <div className="border-b border-gray-300 mb-2 h-10" />
            <p className="text-xs text-gray-500">Name: {po.createdBy.name}</p>
            <p className="text-xs text-gray-500 mt-1">Date: _______________</p>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6">Accepted by (Supplier)</p>
            <div className="border-b border-gray-300 mb-2 h-10" />
            <p className="text-xs text-gray-500">Name: _______________</p>
            <p className="text-xs text-gray-500 mt-1">Date: _______________</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-100 text-center text-xs text-gray-400">
          <p>This is a computer-generated document. {po.poNumber} · Veltriance Technology · info@veltriance.com</p>
        </div>
      </div>
    </>
  );
}
