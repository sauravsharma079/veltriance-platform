"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type PO = { id: string; poNumber: string; status: string; currency: string; totalAmount: string; expectedDelivery: string | null };
type Inv = { id: string; invoiceNumber: string; status: string; currency: string; totalAmount: string; dueDate: string | null; paidAt: string | null; paymentReference: string | null; rejectionReason: string | null; purchaseOrder: { poNumber: string } | null };
type Data = { supplier: string; buyer: string; email: string; purchaseOrders: PO[]; invoices: Inv[] };

const INV_LABEL: Record<string, string> = { RECEIVED: "Received", MATCHED: "Being approved", EXCEPTION: "Needs attention", APPROVED: "Approved for payment", PAID: "Paid", REJECTED: "Rejected" };
const PO_LABEL: Record<string, string> = { SENT: "Needs your confirmation", ACKNOWLEDGED: "Confirmed", PARTIALLY_RECEIVED: "Partly delivered", RECEIVED: "Delivered", CLOSED: "Closed", CANCELLED: "Cancelled" };
const money = (n: string, c: string) => `${c} ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const input = "text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white w-full";

function Login({ expired }: { expired: boolean }) {
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/supplier/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    setBusy(false);
    if (r.ok) setSent(true); else setErr((await r.json().catch(() => null))?.error ?? "Something went wrong");
  }
  return (
    <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center px-5">
      <div className="bg-white border border-gray-300 rounded-2xl p-8 w-full max-w-sm">
        <h1 className="text-lg font-semibold text-gray-900">Supplier portal</h1>
        <p className="text-sm text-gray-500 mt-1 mb-5">See your purchase orders, confirm them and send invoices.</p>
        {expired && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">That link has expired. Request a new one below.</p>}
        {sent ? <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-3">If that address is on file with one of our buyers, a sign-in link is on its way. It works for 24 hours.</p> : (
          <div className="space-y-3">
            <input className={input} type="email" placeholder="Your email address" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} />
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button disabled={busy || !email} onClick={go} className="w-full text-sm px-4 py-2.5 rounded-lg bg-gray-900 text-white disabled:opacity-50">{busy ? "Sending…" : "Email me a sign-in link"}</button>
            <p className="text-xs text-gray-400">No password needed. Use the address your buyer has on file for you.</p>
          </div>)}
      </div>
    </div>
  );
}

function Portal() {
  const expired = useSearchParams().get("expired") === "1";
  const [d, setD] = useState<Data | null>(null); const [state, setState] = useState<"loading" | "out" | "in">("loading");
  const load = useCallback(async () => { const r = await fetch("/api/supplier/overview"); if (!r.ok) { setState("out"); return; } setD(await r.json()); setState("in"); }, []);
  useEffect(() => { load(); }, [load]);
  async function logout() { await fetch("/api/supplier/logout", { method: "POST" }); setD(null); setState("out"); }

  if (state === "loading") return <div className="p-8 text-sm text-gray-400">Loading…</div>;
  if (state === "out" || !d) return <Login expired={expired} />;
  const todo = d.purchaseOrders.filter(p => p.status === "SENT");
  return (
    <div className="min-h-screen bg-[#F7F8FA]"><div className="max-w-3xl mx-auto px-5 py-8">
      <div className="flex justify-between items-start mb-6">
        <div><p className="text-xs text-gray-400">Supplier portal · {d.buyer}</p><h1 className="text-xl font-semibold text-gray-900">{d.supplier}</h1></div>
        <button onClick={logout} className="text-xs text-gray-500 underline">Sign out</button>
      </div>
      {todo.length > 0 && <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-xl px-4 py-3 mb-6">{todo.length} order{todo.length > 1 ? "s" : ""} waiting for your confirmation.</div>}

      <h2 className="text-sm font-semibold text-gray-700 mb-2">Purchase orders</h2>
      {d.purchaseOrders.length === 0 ? <p className="text-sm text-gray-400 mb-6">No orders yet.</p> : (
        <div className="bg-white border border-gray-300 rounded-xl divide-y divide-gray-100 mb-8">{d.purchaseOrders.map(p => (
          <Link key={p.id} href={`/supplier/po/${p.id}`} className="px-4 py-3 flex justify-between items-center hover:bg-gray-50 text-sm">
            <span><span className="font-medium text-gray-900">{p.poNumber}</span><span className="text-gray-400 ml-3">{money(p.totalAmount, p.currency)}</span></span>
            <span className={p.status === "SENT" ? "text-amber-700 font-medium" : "text-gray-500"}>{PO_LABEL[p.status] ?? p.status}</span>
          </Link>))}</div>)}

      <h2 className="text-sm font-semibold text-gray-700 mb-2">Your invoices</h2>
      {d.invoices.length === 0 ? <p className="text-sm text-gray-400">Open an order to send an invoice against it.</p> : (
        <div className="bg-white border border-gray-300 rounded-xl divide-y divide-gray-100">{d.invoices.map(i => (
          <div key={i.id} className="px-4 py-3 text-sm">
            <div className="flex justify-between"><span><span className="font-medium text-gray-900">{i.invoiceNumber}</span><span className="text-gray-400 ml-3">{i.purchaseOrder?.poNumber} · {money(i.totalAmount, i.currency)}</span></span><span className={i.status === "PAID" ? "text-emerald-700" : i.status === "REJECTED" || i.status === "EXCEPTION" ? "text-red-600" : "text-gray-500"}>{INV_LABEL[i.status] ?? i.status}</span></div>
            {i.status === "PAID" && <p className="text-xs text-gray-400 mt-1">Paid {i.paidAt ? new Date(i.paidAt).toLocaleDateString() : ""}{i.paymentReference ? ` · ref ${i.paymentReference}` : ""}</p>}
            {i.status === "REJECTED" && i.rejectionReason && <p className="text-xs text-red-600 mt-1">{i.rejectionReason}</p>}
          </div>))}</div>)}
    </div></div>
  );
}

export default function SupplierPage() { return <Suspense fallback={null}><Portal /></Suspense>; }
