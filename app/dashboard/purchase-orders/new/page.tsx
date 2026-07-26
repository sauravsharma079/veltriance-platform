"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

type Supplier = { id: string; name: string; contactEmail: string | null };
type RequisitionOption = { id: string; requisitionNumber: string; title: string; totalAmount: string; currency: string };

type LineItem = { description: string; quantity: string; unitPrice: string; glAccount: string };

export default function NewPOPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromReqId = searchParams.get("requisitionId");

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [requisitions, setRequisitions] = useState<RequisitionOption[]>([]);
  const [form, setForm] = useState({
    requisitionId: fromReqId ?? "",
    supplierId: "",
    supplierEmail: "",
    routingMethod: "EMAIL" as "EMAIL" | "MANUAL" | "CXML",
    currency: "USD",
    paymentTerms: "",
    deliveryAddress: "",
    notes: "",
    expectedDelivery: "",
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: "1", unitPrice: "0", glAccount: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/suppliers?status=ACTIVE")
      .then(r => r.json())
      .then(d => setSuppliers(d.suppliers ?? []));
    fetch("/api/requisitions?scope=all")
      .then(r => r.json())
      .then(d => setRequisitions(
        (d.requisitions ?? []).filter((r: { status: string }) => r.status === "APPROVED")
      ));
  }, []);

  function updateLine(i: number, key: keyof LineItem, value: string) {
    setLineItems(prev => prev.map((li, idx) => idx === i ? { ...li, [key]: value } : li));
  }
  function addLine() { setLineItems(prev => [...prev, { description: "", quantity: "1", unitPrice: "0", glAccount: "" }]); }
  function removeLine(i: number) { setLineItems(prev => prev.filter((_, idx) => idx !== i)); }

  const total = lineItems.reduce((sum, li) => sum + (Number(li.quantity) * Number(li.unitPrice)), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        requisitionId: form.requisitionId || undefined,
        supplierId: form.supplierId || undefined,
        lineItems: lineItems.map(li => ({
          description: li.description,
          quantity: Number(li.quantity),
          unitPrice: Number(li.unitPrice),
          glAccount: li.glAccount || undefined,
        })),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Please check the form.");
      return;
    }
    router.push(`/dashboard/purchase-orders/${data.purchaseOrder.id}`);
  }

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/dashboard/purchase-orders" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft className="size-3.5" /> Back
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Create purchase order</h1>
      <p className="text-sm text-gray-500 mb-6">Issue a PO to a supplier, optionally linked to an approved requisition.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Header details */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">PO details</p>

          {requisitions.length > 0 && (
            <Field label="Link to approved requisition (optional)">
              <select value={form.requisitionId} onChange={e => setForm(f => ({ ...f, requisitionId: e.target.value }))} className="input">
                <option value="">— None —</option>
                {requisitions.map(r => (
                  <option key={r.id} value={r.id}>{r.requisitionNumber} — {r.title}</option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier">
              <select value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))} className="input">
                <option value="">— Select supplier —</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Currency">
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="input">
                {["USD", "EUR", "GBP", "INR", "AUD", "CAD", "SGD", "AED"].map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Routing method">
              <select value={form.routingMethod} onChange={e => setForm(f => ({ ...f, routingMethod: e.target.value as "EMAIL" | "MANUAL" | "CXML" }))} className="input">
                <option value="EMAIL">Email</option>
                <option value="MANUAL">Manual</option>
                <option value="CXML">cXML</option>
              </select>
            </Field>
            {form.routingMethod === "EMAIL" && (
              <Field label="Supplier email">
                <input type="email" value={form.supplierEmail} onChange={e => setForm(f => ({ ...f, supplierEmail: e.target.value }))} className="input" placeholder="supplier@company.com" />
              </Field>
            )}
            {form.routingMethod === "CXML" && (
              <Field label="cXML endpoint URL">
                <input type="url" value={form.supplierEmail} onChange={e => setForm(f => ({ ...f, supplierEmail: e.target.value }))} className="input" placeholder="https://supplier.com/cxml" />
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Payment terms">
              <input value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))} className="input" placeholder="Net 30" />
            </Field>
            <Field label="Expected delivery">
              <input type="date" value={form.expectedDelivery} onChange={e => setForm(f => ({ ...f, expectedDelivery: e.target.value }))} className="input" />
            </Field>
          </div>

          <Field label="Delivery address">
            <textarea rows={2} value={form.deliveryAddress} onChange={e => setForm(f => ({ ...f, deliveryAddress: e.target.value }))} className="input resize-none" placeholder="Noida office, Sector 62…" />
          </Field>

          <Field label="Notes to supplier">
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input resize-none" placeholder="Any special instructions…" />
          </Field>
        </div>

        {/* Line items */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Line items</p>
          <div className="space-y-3">
            {lineItems.map((li, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  {i === 0 && <label className="block text-xs text-gray-500 mb-1">Description</label>}
                  <input required value={li.description} onChange={e => updateLine(i, "description", e.target.value)} className="input" placeholder="Description" />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs text-gray-500 mb-1">Qty</label>}
                  <input required type="number" min="0" step="0.01" value={li.quantity} onChange={e => updateLine(i, "quantity", e.target.value)} className="input" />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs text-gray-500 mb-1">Unit price</label>}
                  <input required type="number" min="0" step="0.01" value={li.unitPrice} onChange={e => updateLine(i, "unitPrice", e.target.value)} className="input" />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs text-gray-500 mb-1">GL account</label>}
                  <input value={li.glAccount} onChange={e => updateLine(i, "glAccount", e.target.value)} className="input" placeholder="6000-01" />
                </div>
                <div className="col-span-1 flex justify-end pb-0.5">
                  {lineItems.length > 1 && (
                    <button type="button" onClick={() => removeLine(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addLine} className="mt-3 flex items-center gap-1.5 text-sm text-[#1A2A52] hover:underline">
            <Plus className="size-3.5" /> Add line item
          </button>
          <div className="flex justify-end mt-4 pt-3 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-800">Total: {form.currency} {total.toLocaleString()}</p>
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button type="submit" disabled={loading} className="w-full bg-[#1A2A52] text-white text-sm font-medium py-2.5 rounded-lg hover:bg-[#243766] transition-colors disabled:opacity-50">
          {loading ? "Creating…" : "Create purchase order"}
        </button>
      </form>

      <style jsx global>{`
        .input { width: 100%; border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
        .input:focus { border-color: #1a2a52; box-shadow: 0 0 0 1px #1a2a52; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
