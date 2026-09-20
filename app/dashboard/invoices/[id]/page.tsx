"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { ActivityLog } from "@/components/ActivityLog";
import { INVOICE_STATUS_STYLE } from "@/lib/contract-ui";

type Issue = { code: string; blocking: boolean; message: string; poLineId?: string };
type LineM = { poLineId: string | null; description: string; ordered: number | null; received: number | null; invoicedBefore: number; invoicedNow: number; poUnitPrice: number | null; invoiceUnitPrice: number; priceVariancePct: number | null; ok: boolean };
type Inv = {
  id: string; internalNumber: string; invoiceNumber: string; status: string; invoiceDate: string; dueDate: string | null; currency: string; subtotal: string; taxAmount: string; totalAmount: string;
  matchResult: { status: string; issues: Issue[]; lines: LineM[]; checkedAt: string } | null; approvedAt: string | null; approvalNote: string | null; overridden: boolean; rejectionReason: string | null; paidAt: string | null; paymentReference: string | null; notes: string | null;
  supplier: { id: string; name: string; status: string }; purchaseOrder: { id: string; poNumber: string; status: string } | null; createdBy: { name: string };
};
const btn = "text-xs px-3 py-1.5 rounded-lg disabled:opacity-50";
const primary = `${btn} bg-[#1A2A52] text-white hover:bg-[#14203f]`;
const ghost = `${btn} border border-gray-200 text-gray-600 hover:bg-gray-50`;
const money = (n: string | number, c: string) => `${c} ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<{ invoice: Inv; me: { id: string; role: string }; canApprove: boolean; selfApproval: boolean; approveBlockedReason: string | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null); const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/invoices/${id}`);
    if (!res.ok) { setError((await res.json().catch(() => null))?.error ?? "Could not load the invoice"); return; }
    setD(await res.json());
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function act(action: string, extra: { reason?: string; reference?: string } = {}) {
    setBusy(action); setError(null); setInfo(null);
    const res = await fetch(`/api/invoices/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    const r = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) { setError(r?.error ?? "That didn't work"); return; }
    if (r.selfApproval) setInfo("Approved. Because nobody else was available, this is recorded as a self-approval in the audit trail.");
    if (action === "rematch") setInfo(r.match?.status === "MATCHED" ? "Re-checked: it now matches." : "Re-checked: it still has exceptions.");
    await load();
  }
  const ask = (q: string) => prompt(q)?.trim() || null;

  if (error && !d) return <div className="p-8 text-sm text-red-600">{error}</div>;
  if (!d) return <div className="p-8 text-sm text-gray-400">Loading…</div>;
  const { invoice: v } = d;
  const m = v.matchResult;
  const blocking = m?.issues.filter(i => i.blocking) ?? [], notes = m?.issues.filter(i => !i.blocking) ?? [];
  const isAdmin = d.me.role === "ADMIN";
  return (
    <div className="p-8 max-w-5xl space-y-5">
      <div>
        <Link href="/dashboard/invoices" className="text-xs text-gray-400 hover:underline">← Invoices</Link>
        <div className="flex items-start justify-between gap-4 mt-1">
          <div><h1 className="text-xl font-semibold text-gray-900">Invoice {v.invoiceNumber}</h1>
            <p className="text-xs text-gray-400 mt-1">{v.internalNumber} · {v.supplier.name} · {v.purchaseOrder ? <Link href={`/dashboard/purchase-orders/${v.purchaseOrder.id}`} className="hover:underline">{v.purchaseOrder.poNumber}</Link> : "no PO"} · entered by {v.createdBy.name}</p></div>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${INVOICE_STATUS_STYLE[v.status]}`}>{v.status.toLowerCase()}{v.overridden ? " · overridden" : ""}</span>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl">{error}</div>}
      {info && <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs px-4 py-3 rounded-xl">{info}</div>}

      {v.status === "APPROVED" && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex gap-2"><CheckCircle2 className="size-4 shrink-0" /><span>Approved for payment{v.approvedAt ? ` on ${new Date(v.approvedAt).toLocaleDateString()}` : ""}. {v.approvalNote}</span></div>}
      {v.status === "PAID" && <div className="bg-purple-50 border border-purple-200 text-purple-800 text-xs px-4 py-3 rounded-xl">Paid on {v.paidAt && new Date(v.paidAt).toLocaleDateString()} · reference {v.paymentReference}</div>}
      {v.status === "REJECTED" && <div className="bg-gray-100 border border-gray-200 text-gray-700 text-xs px-4 py-3 rounded-xl">Rejected: {v.rejectionReason}</div>}

      <div className="flex flex-wrap gap-2">
        {v.status === "MATCHED" && (d.canApprove
          ? <button disabled={!!busy} onClick={() => act("approve")} className={primary}>{d.selfApproval ? "Approve (self-approval)" : "Approve for payment"}</button>
          : <span className="text-xs text-gray-400 self-center">{d.approveBlockedReason}</span>)}
        {v.status === "EXCEPTION" && isAdmin && <button disabled={!!busy} onClick={() => { const r = ask("Why are you approving this despite the exceptions? (recorded in the audit trail)"); if (r) act("override", { reason: r }); }} className={primary}>Approve despite exceptions</button>}
        {v.status === "EXCEPTION" && !isAdmin && <span className="text-xs text-gray-400 self-center">An Admin must decide on an invoice with exceptions — or reject it, or wait for the goods to be received.</span>}
        {["RECEIVED", "MATCHED", "EXCEPTION"].includes(v.status) && <button disabled={!!busy} onClick={() => act("rematch")} className={ghost}>Re-check match</button>}
        {["RECEIVED", "MATCHED", "EXCEPTION"].includes(v.status) && <button disabled={!!busy} onClick={() => { const r = ask("Why are you rejecting this invoice?"); if (r) act("reject", { reason: r }); }} className={ghost}>Reject</button>}
        {v.status === "APPROVED" && <button disabled={!!busy} onClick={() => { const r = ask("Payment reference (bank transfer / UTR number)"); if (r) act("mark_paid", { reference: r }); }} className={primary}>Mark as paid</button>}
      </div>

      {blocking.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1.5">
          <p className="text-sm font-medium text-red-900 flex items-center gap-1.5"><AlertTriangle className="size-4" />{blocking.length} exception{blocking.length > 1 ? "s" : ""} — this can&apos;t be paid until resolved</p>
          {blocking.map((i, k) => <p key={k} className="text-xs text-red-800">• {i.message}</p>)}
        </div>
      )}
      {notes.length > 0 && <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">{notes.map((i, k) => <p key={k} className="text-xs text-amber-900 flex gap-1.5"><Info className="size-3.5 shrink-0 mt-0.5" />{i.message}</p>)}</div>}
      {m && blocking.length === 0 && <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-800 flex gap-2"><CheckCircle2 className="size-4 shrink-0" />Three-way match passed: the invoice agrees with the purchase order, what was received, and what has already been billed.</div>}

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Three-way match</p>
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] text-gray-400 border-b border-gray-100"><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Ordered</th><th className="px-3 py-2 text-right">Received</th><th className="px-3 py-2 text-right">Billed before</th><th className="px-3 py-2 text-right">On this invoice</th><th className="px-3 py-2 text-right">PO price</th><th className="px-3 py-2 text-right">Invoice price</th><th className="px-3 py-2 w-8" /></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {(m?.lines ?? []).map((l, i) => (
                <tr key={i} className={l.ok ? "" : "bg-red-50/40"}>
                  <td className="px-3 py-2 text-gray-800">{l.description}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{l.ordered ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{l.received ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{l.invoicedBefore}</td>
                  <td className="px-3 py-2 text-right text-gray-800">{l.invoicedNow}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{l.poUnitPrice ?? "—"}</td>
                  <td className={`px-3 py-2 text-right ${l.priceVariancePct != null && Math.abs(l.priceVariancePct) > 0.05 ? "text-amber-700" : "text-gray-800"}`}>{l.invoiceUnitPrice}{l.priceVariancePct != null && Math.abs(l.priceVariancePct) > 0.05 ? ` (${l.priceVariancePct > 0 ? "+" : ""}${l.priceVariancePct.toFixed(1)}%)` : ""}</td>
                  <td className="px-3 py-2">{l.ok ? <CheckCircle2 className="size-4 text-emerald-600" /> : <AlertTriangle className="size-4 text-red-600" />}</td>
                </tr>
              ))}
              {!m && <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-gray-400">Not matched yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="text-right text-sm text-gray-700 mt-3">Subtotal {money(v.subtotal, v.currency)} + tax {money(v.taxAmount, v.currency)} = <strong>{money(v.totalAmount, v.currency)}</strong>{v.dueDate ? ` · due ${new Date(v.dueDate).toLocaleDateString()}` : ""}</div>
      </div>
      {v.notes && <p className="text-xs text-gray-500">Notes: {v.notes}</p>}
      <ActivityLog entity="INVOICE" entityId={v.id} title="Activity" />
    </div>
  );
}
