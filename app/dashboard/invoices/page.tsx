"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Receipt, Plus, Search, Settings2 } from "lucide-react";
import { INVOICE_STATUS_STYLE } from "@/lib/contract-ui";

type Row = { id: string; internalNumber: string; invoiceNumber: string; status: string; invoiceDate: string; dueDate: string | null; currency: string; totalAmount: string; overridden: boolean; issues: number; supplier: { name: string }; purchaseOrder: { id: string; poNumber: string } | null };
type Settings = { pricePct: number; qtyPct: number; autoApprove: boolean; canEdit: boolean };
const FILTERS = ["", "EXCEPTION", "MATCHED", "APPROVED", "PAID", "REJECTED"];
const input = "text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white";

export default function InvoicesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState(""); const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true); const [blocked, setBlocked] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null); const [showRules, setShowRules] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    const p = new URLSearchParams(); if (q) p.set("q", q); if (status) p.set("status", status);
    const res = await fetch(`/api/invoices?${p}`);
    if (!res.ok) { setBlocked((await res.json().catch(() => null))?.error ?? "Invoices aren't available for your account."); setLoading(false); return; }
    setRows((await res.json()).invoices); setLoading(false);
  }, [q, status]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);
  useEffect(() => { fetch("/api/invoices/settings").then(r => r.ok ? r.json() : null).then(setSettings).catch(() => {}); }, []);

  async function saveRules() {
    if (!settings) return;
    const res = await fetch("/api/invoices/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pricePct: settings.pricePct, qtyPct: settings.qtyPct, autoApprove: settings.autoApprove }) });
    setSaved(res.ok ? "Saved." : (await res.json().catch(() => null))?.error ?? "Could not save");
    setTimeout(() => setSaved(null), 2500);
  }

  if (blocked) return <div className="p-8 max-w-xl"><h1 className="text-xl font-semibold text-gray-900">Invoices</h1><p className="text-sm text-gray-500 mt-2">{blocked}</p></div>;
  const exceptions = rows.filter(r => r.status === "EXCEPTION").length, awaiting = rows.filter(r => r.status === "MATCHED").length;
  return (
    <div className="p-8 max-w-6xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2"><Receipt className="size-5" /> Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">Every supplier invoice is matched against the purchase order, what was actually received, and what&apos;s already been billed — before it can be paid.</p>
        </div>
        <div className="flex gap-2">
          {settings && <button onClick={() => setShowRules(s => !s)} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"><Settings2 className="size-3.5" />Match rules</button>}
          <Link href="/dashboard/invoices/new" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-[#1A2A52] text-white hover:bg-[#14203f]"><Plus className="size-3.5" />Enter invoice</Link>
        </div>
      </div>

      {showRules && settings && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <p className="text-sm font-medium text-gray-900">How strictly invoices are matched</p>
          <div className="flex flex-wrap items-end gap-6 text-xs text-gray-600">
            <label>Price may exceed the PO by (%)<br /><input disabled={!settings.canEdit} type="number" min="0" max="25" step="0.5" value={settings.pricePct} onChange={e => setSettings({ ...settings, pricePct: Number(e.target.value) })} className={`${input} w-24 mt-1`} /></label>
            <label>Quantity may exceed what was received by (%)<br /><input disabled={!settings.canEdit} type="number" min="0" max="25" step="0.5" value={settings.qtyPct} onChange={e => setSettings({ ...settings, qtyPct: Number(e.target.value) })} className={`${input} w-24 mt-1`} /></label>
            <label className="flex items-center gap-2"><input disabled={!settings.canEdit} type="checkbox" checked={settings.autoApprove} onChange={e => setSettings({ ...settings, autoApprove: e.target.checked })} />Approve clean matches automatically</label>
          </div>
          <p className="text-[11px] text-gray-400">A price or quantity outside these limits becomes an exception for a person to decide. With automatic approval off, even clean matches wait for someone other than the person who entered them.</p>
          {settings.canEdit ? <div className="flex items-center gap-3"><button onClick={saveRules} className="text-xs px-3 py-1.5 rounded-lg bg-[#1A2A52] text-white">Save rules</button>{saved && <span className="text-xs text-gray-500">{saved}</span>}</div> : <p className="text-[11px] text-gray-400">Only an Admin can change these.</p>}
        </div>
      )}

      {(exceptions > 0 || awaiting > 0) && <div className="flex gap-3 text-xs">{exceptions > 0 && <span className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-1.5">{exceptions} exception{exceptions > 1 ? "s" : ""} need a decision</span>}{awaiting > 0 && <span className="bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5">{awaiting} matched, awaiting approval</span>}</div>}

      <div className="flex flex-wrap gap-2">
        <div className="relative"><Search className="size-3.5 absolute left-3 top-2.5 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search invoice, supplier, PO…" className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg w-72 bg-white" /></div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">{FILTERS.map(f => <option key={f} value={f}>{f ? f.toLowerCase() : "All statuses"}</option>)}</select>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {loading ? <p className="p-8 text-sm text-gray-400">Loading…</p> : rows.length === 0 ? <p className="p-10 text-center text-sm text-gray-400">No invoices yet.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100"><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">PO</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3"><Link href={`/dashboard/invoices/${r.id}`} className="font-medium text-gray-900 hover:underline">{r.invoiceNumber}</Link><p className="text-xs text-gray-400">{r.internalNumber} · {new Date(r.invoiceDate).toLocaleDateString()}</p></td>
                  <td className="px-4 py-3 text-gray-600">{r.supplier.name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.purchaseOrder ? <Link href={`/dashboard/purchase-orders/${r.purchaseOrder.id}`} className="hover:underline">{r.purchaseOrder.poNumber}</Link> : "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{r.currency} {Number(r.totalAmount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-600">{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${INVOICE_STATUS_STYLE[r.status]}`}>{r.status.toLowerCase()}</span>{r.status === "EXCEPTION" && <span className="ml-2 text-[10px] text-red-600">{r.issues} issue{r.issues > 1 ? "s" : ""}</span>}{r.overridden && <span className="ml-2 text-[10px] text-amber-600">overridden</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
