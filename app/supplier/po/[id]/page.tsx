"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Line = { id: string; description: string; unit: string | null; ordered: number; unitPrice: number; received: number; invoiced: number; invoiceable: number };
type Data = { buyer: string; po: { id: string; poNumber: string; status: string; currency: string; totalAmount: string; paymentTerms: string | null; notes: string | null; expectedDelivery: string | null }; lines: Line[] };
const input = "text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white w-full";
const today = () => new Date().toISOString().slice(0, 10);

export default function SupplierPo() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Data | null>(null); const [gone, setGone] = useState(false);
  const [date, setDate] = useState(""); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [inv, setInv] = useState({ number: "", date: today(), due: "", tax: "0" }); const [qty, setQty] = useState<Record<string, string>>({}); const [price, setPrice] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const r = await fetch(`/api/supplier/po/${id}`);
    if (!r.ok) { setGone(true); return; }
    const j: Data = await r.json(); setD(j);
    setQty(Object.fromEntries(j.lines.map(l => [l.id, l.invoiceable > 0 ? String(l.invoiceable) : ""])));
    setPrice(Object.fromEntries(j.lines.map(l => [l.id, String(l.unitPrice)])));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function ack() {
    const r = await fetch(`/api/supplier/po/${id}/acknowledge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedDelivery: date || null }) });
    const j = await r.json().catch(() => null);
    setMsg(r.ok ? { ok: true, text: "Thank you — confirmed." } : { ok: false, text: j?.error ?? "That didn't work" }); if (r.ok) load();
  }
  async function submit() {
    const lines = d!.lines.filter(l => Number(qty[l.id]) > 0).map(l => ({ poLineId: l.id, quantity: Number(qty[l.id]), unitPrice: Number(price[l.id]) }));
    if (!lines.length) { setMsg({ ok: false, text: "Enter a quantity on at least one line." }); return; }
    const r = await fetch("/api/supplier/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purchaseOrderId: id, invoiceNumber: inv.number, invoiceDate: inv.date, dueDate: inv.due || null, taxAmount: Number(inv.tax) || 0, lines }) });
    const j = await r.json().catch(() => null);
    if (!r.ok) { setMsg({ ok: false, text: j?.error ?? "That didn't work" }); return; }
    setMsg({ ok: true, text: j.issues?.length ? `Invoice ${j.reference} received, but it's on hold: ${j.issues.join(" ")}` : `Invoice ${j.reference} received. ${j.status === "APPROVED" ? "It has been approved for payment." : "It's being checked and approved."}` });
    setInv({ number: "", date: today(), due: "", tax: "0" }); load();
  }

  if (gone) return <div className="p-8 text-sm text-gray-500">This order isn&apos;t available. <Link href="/supplier" className="underline">Back to your portal</Link></div>;
  if (!d) return <div className="p-8 text-sm text-gray-400">Loading…</div>;
  const canBill = d.lines.some(l => l.invoiceable > 0);
  return (
    <div className="min-h-screen bg-[#F7F8FA]"><div className="max-w-3xl mx-auto px-5 py-8">
      <Link href="/supplier" className="text-xs text-gray-500 underline">← All orders</Link>
      <h1 className="text-xl font-semibold text-gray-900 mt-2">{d.po.poNumber}</h1>
      <p className="text-sm text-gray-500">{d.buyer} · {d.po.currency} {Number(d.po.totalAmount).toLocaleString()}{d.po.paymentTerms ? ` · ${d.po.paymentTerms}` : ""}</p>
      {msg && <div className={`mt-4 text-sm px-4 py-3 rounded-lg border ${msg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</div>}

      <div className="bg-white border border-gray-300 rounded-xl mt-5 divide-y divide-gray-100">
        {d.lines.map(l => <div key={l.id} className="px-4 py-3 text-sm flex justify-between gap-4"><span className="text-gray-800">{l.description}</span><span className="text-gray-500 text-right shrink-0">{l.ordered}{l.unit ? ` ${l.unit}` : ""} × {l.unitPrice} · delivered {l.received} · billed {l.invoiced}</span></div>)}
      </div>

      {["SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED"].includes(d.po.status) && (
        <div className="bg-white border border-gray-300 rounded-xl p-5 mt-5">
          <p className="text-sm font-medium text-gray-900">{d.po.status === "SENT" ? "Confirm this order" : "Delivery date"}</p>
          <div className="flex gap-3 mt-3"><input type="date" className={input} min={today()} value={date} onChange={e => setDate(e.target.value)} /><button onClick={ack} className="text-sm px-4 py-2 rounded-lg bg-gray-900 text-white shrink-0">{d.po.status === "SENT" ? "Confirm order" : "Update date"}</button></div>
          <p className="text-xs text-gray-400 mt-2">{d.po.expectedDelivery ? `Currently expected ${new Date(d.po.expectedDelivery).toLocaleDateString()}. ` : ""}Tell us when you&apos;ll deliver — we&apos;ll ask the buyer to confirm arrival then.</p>
        </div>)}

      {canBill && (
        <div className="bg-white border border-gray-300 rounded-xl p-5 mt-5">
          <p className="text-sm font-medium text-gray-900 mb-1">Send an invoice</p>
          <p className="text-xs text-gray-500 mb-4">You can invoice what has been delivered and not yet billed. Invoices for goods not yet received are held until they arrive.</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <input className={input} placeholder="Your invoice number" value={inv.number} onChange={e => setInv({ ...inv, number: e.target.value })} />
            <input className={input} placeholder="Tax amount" inputMode="decimal" value={inv.tax} onChange={e => setInv({ ...inv, tax: e.target.value })} />
            <label className="text-xs text-gray-500">Invoice date<input type="date" className={input} value={inv.date} onChange={e => setInv({ ...inv, date: e.target.value })} /></label>
            <label className="text-xs text-gray-500">Due date (optional)<input type="date" className={input} value={inv.due} onChange={e => setInv({ ...inv, due: e.target.value })} /></label>
          </div>
          <div className="space-y-2">{d.lines.map(l => (
            <div key={l.id} className="grid grid-cols-[1fr_90px_100px] gap-2 items-center text-sm"><span className="text-gray-700 truncate">{l.description}</span><input className={input} placeholder="Qty" inputMode="decimal" value={qty[l.id] ?? ""} onChange={e => setQty({ ...qty, [l.id]: e.target.value })} /><input className={input} placeholder="Unit price" inputMode="decimal" value={price[l.id] ?? ""} onChange={e => setPrice({ ...price, [l.id]: e.target.value })} /></div>))}</div>
          <button onClick={submit} disabled={!inv.number} className="mt-4 text-sm px-4 py-2 rounded-lg bg-emerald-700 text-white disabled:opacity-50">Submit invoice</button>
        </div>)}
    </div></div>
  );
}
