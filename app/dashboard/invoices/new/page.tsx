"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type PoOpt = { id: string; poNumber: string; status: string; currency: string; supplier: { id: string; name: string } | null };
type Line = { id: string; description: string; unit: string | null; ordered: number; unitPrice: number; received: number; invoiced: number; invoiceable: number };
type Row = { poLineId: string | null; description: string; quantity: string; unitPrice: string };
const input = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white";

export default function NewInvoicePage() {
  const router = useRouter();
  const [pos, setPos] = useState<PoOpt[]>([]);
  const [poId, setPoId] = useState("");
  const [info, setInfo] = useState<{ poNumber: string; supplierId: string | null; currency: string; lines: Line[] } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [f, setF] = useState({ invoiceNumber: "", invoiceDate: new Date().toISOString().slice(0, 10), dueDate: "", taxAmount: "", notes: "" });
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetch("/api/invoices/options").then(r => r.json()).then(d => setPos(d.purchaseOrders ?? [])).catch(() => {}); }, []);
  useEffect(() => {
    if (!poId) return;
    fetch(`/api/invoices/po/${poId}`).then(r => r.json()).then(d => {
      setInfo(d);
      // Prefill with what has been received and not yet billed — the natural thing to invoice.
      setRows((d.lines as Line[]).filter(l => l.invoiceable > 0).map(l => ({ poLineId: l.id, description: l.description, quantity: String(l.invoiceable), unitPrice: String(l.unitPrice) })));
    }).catch(() => {});
  }, [poId]);

  const num = (s: string) => Number(s) || 0;
  const subtotal = rows.reduce((s, r) => s + num(r.quantity) * num(r.unitPrice), 0);
  const tax = f.taxAmount === "" ? 0 : num(f.taxAmount);
  const set = (i: number, patch: Partial<Row>) => setRows(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null);
    const res = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      purchaseOrderId: poId || null, supplierId: info?.supplierId ?? undefined, invoiceNumber: f.invoiceNumber, invoiceDate: f.invoiceDate, dueDate: f.dueDate || null,
      subtotal: Math.round(subtotal * 100) / 100, taxAmount: tax, totalAmount: Math.round((subtotal + tax) * 100) / 100, notes: f.notes || null,
      lines: rows.filter(r => num(r.quantity) > 0).map(r => ({ poLineId: r.poLineId, description: r.description, quantity: num(r.quantity), unitPrice: num(r.unitPrice), lineTotal: Math.round(num(r.quantity) * num(r.unitPrice) * 100) / 100 })),
    }) });
    const d = await res.json().catch(() => null);
    if (!res.ok) { setError(d?.error ?? "Could not save the invoice"); setSaving(false); return; }
    router.push(`/dashboard/invoices/${d.invoice.id}`);
  }

  return (
    <form onSubmit={submit} className="p-8 max-w-4xl space-y-5">
      <div><h1 className="text-xl font-semibold text-gray-900">Enter a supplier invoice</h1><p className="text-sm text-gray-500 mt-1">Type in the figures exactly as they appear on the supplier&apos;s invoice — the system checks them against the order and what was received.</p></div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl">{error}</div>}
      <label className="block"><span className="text-xs text-gray-500">Purchase order</span>
        <select required value={poId} onChange={e => setPoId(e.target.value)} className={input}><option value="">Choose the PO this invoice is for…</option>{pos.map(p => <option key={p.id} value={p.id}>{p.poNumber} — {p.supplier?.name ?? "no supplier"} ({p.status.toLowerCase().replace("_", " ")})</option>)}</select></label>
      {info && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <label className="block"><span className="text-xs text-gray-500">Supplier&apos;s invoice number</span><input required value={f.invoiceNumber} onChange={e => setF({ ...f, invoiceNumber: e.target.value })} className={input} /></label>
            <label className="block"><span className="text-xs text-gray-500">Invoice date</span><input required type="date" value={f.invoiceDate} onChange={e => setF({ ...f, invoiceDate: e.target.value })} className={input} /></label>
            <label className="block"><span className="text-xs text-gray-500">Due date</span><input type="date" value={f.dueDate} onChange={e => setF({ ...f, dueDate: e.target.value })} className={input} /></label>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Lines</p>
            <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] text-gray-400 border-b border-gray-100"><th className="px-3 py-2">Item</th><th className="px-3 py-2 w-28 text-right">Quantity</th><th className="px-3 py-2 w-32 text-right">Unit price ({info.currency})</th><th className="px-3 py-2 w-32 text-right">Total</th></tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((r, i) => { const l = info.lines.find(x => x.id === r.poLineId); return (
                    <tr key={i}>
                      <td className="px-3 py-2 text-gray-800">{r.description}{l && <p className="text-[11px] text-gray-400">ordered {l.ordered} · received {l.received} · already billed {l.invoiced} · PO price {l.unitPrice}</p>}</td>
                      <td className="px-2 py-1"><input type="number" min="0" step="0.01" value={r.quantity} onChange={e => set(i, { quantity: e.target.value })} className={`${input} text-right`} /></td>
                      <td className="px-2 py-1"><input type="number" min="0" step="0.01" value={r.unitPrice} onChange={e => set(i, { unitPrice: e.target.value })} className={`${input} text-right`} /></td>
                      <td className="px-3 py-2 text-right text-gray-700">{(num(r.quantity) * num(r.unitPrice)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    </tr>); })}
                  {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-400">Nothing has been received and not yet billed on this PO. You can still record the invoice, but it will be held as an exception until goods are received.</td></tr>}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => setRows(rs => [...rs, { poLineId: null, description: "", quantity: "1", unitPrice: "0" }])} className="text-xs text-[#1A2A52] underline mt-2">Add a line that isn&apos;t on the PO</button>
          </div>
          <div className="grid grid-cols-3 gap-4 items-end">
            <label className="block"><span className="text-xs text-gray-500">Tax on the invoice ({info.currency})</span><input type="number" min="0" step="0.01" value={f.taxAmount} onChange={e => setF({ ...f, taxAmount: e.target.value })} className={input} placeholder="0.00" /></label>
            <div className="col-span-2 text-right text-sm text-gray-700">Subtotal {subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} + tax {tax.toLocaleString()} = <strong>{info.currency} {(subtotal + tax).toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></div>
          </div>
          <label className="block"><span className="text-xs text-gray-500">Notes</span><input value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className={input} /></label>
          <button disabled={saving || !f.invoiceNumber} className="text-sm px-4 py-2 rounded-lg bg-[#1A2A52] text-white hover:bg-[#14203f] disabled:opacity-50">{saving ? "Matching…" : "Save & match"}</button>
        </>
      )}
    </form>
  );
}
