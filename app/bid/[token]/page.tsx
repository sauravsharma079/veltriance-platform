"use client";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Item = { id: string; sequence: number; description: string; quantity: number; unit: string | null; specification: string | null };
type Q = { id: string; text: string; required: boolean };
type Data = {
  organization: string;
  event: { title: string; eventNumber: string; type: string; description: string | null; category: string | null; currency: string; deadline: string | null; requiredDate: string | null; deliveryLocation: string | null; terms: string | null; questions: Q[]; items: Item[]; status: string };
  you: { name: string; status: string };
  bid: { revision: number; submittedAt: string; totalAmount: number; leadTimeDays: number | null; paymentTerms: string | null; validityDays: number | null; notes: string | null; answers: Record<string, string>; lines: { itemId: string; unitPrice: number }[] } | null;
  canBid: boolean; closedReason: string | null;
};
const input = "w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white";
const btn = "text-sm px-4 py-2 rounded-lg disabled:opacity-50";

export default function BidPage() {
  const { token } = useParams<{ token: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [gone, setGone] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState({ leadTimeDays: "", paymentTerms: "", validityDays: "", notes: "" });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [initialised, setInitialised] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/public/sourcing/${token}`);
    if (!res.ok) { setGone(true); return; }
    const data: Data = await res.json();
    setD(data);
    if (data.bid && !initialised) {
      setPrices(Object.fromEntries(data.bid.lines.map(l => [l.itemId, String(l.unitPrice)])));
      setMeta({ leadTimeDays: data.bid.leadTimeDays?.toString() ?? "", paymentTerms: data.bid.paymentTerms ?? "", validityDays: data.bid.validityDays?.toString() ?? "", notes: data.bid.notes ?? "" });
      setAnswers(data.bid.answers ?? {});
    }
    setInitialised(true);
  }, [token, initialised]);
  useEffect(() => { load(); }, [load]);

  async function post(payload: object, okText: string) {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/public/sourcing/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const r = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: r?.error ?? "That didn't work" }); return; }
    setMsg({ ok: true, text: okText }); setInitialised(false); await load();
  }

  if (gone) return <Shell><h1 className="text-lg font-semibold text-gray-900">This link isn&apos;t valid any more</h1><p className="text-sm text-gray-500 mt-2">It may have been replaced by a newer one, or the request is no longer open. Please ask the sender for a fresh link.</p></Shell>;
  if (!d) return <Shell><p className="text-sm text-gray-400">Loading…</p></Shell>;

  const { event: e } = d;
  const total = e.items.reduce((s, i) => s + (Number(prices[i.id]) || 0) * i.quantity, 0);
  const complete = e.items.every(i => Number(prices[i.id]) > 0);
  const submit = () => post({
    action: "submit_bid",
    lines: e.items.map(i => ({ itemId: i.id, unitPrice: Number(prices[i.id]) })),
    leadTimeDays: meta.leadTimeDays ? Number(meta.leadTimeDays) : null, paymentTerms: meta.paymentTerms || null,
    validityDays: meta.validityDays ? Number(meta.validityDays) : null, notes: meta.notes || null, answers,
  }, d.bid ? "Your revised bid has been submitted." : "Thank you — your bid has been submitted.");

  return (
    <Shell>
      <p className="text-xs text-gray-400">{d.organization} · {e.type}</p>
      <h1 className="text-xl font-semibold text-gray-900">{e.title}</h1>
      <p className="text-xs text-gray-400 mt-1">{e.eventNumber}{e.deadline ? ` · bids due ${new Date(e.deadline).toLocaleString()}` : ""} · responding as {d.you.name}</p>

      {msg && <div className={`mt-4 text-sm px-4 py-3 rounded-lg border ${msg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</div>}
      {d.you.status === "DECLINED" && <div className="mt-4 text-sm px-4 py-3 rounded-lg bg-gray-100 text-gray-700">You&apos;ve declined to bid on this request.</div>}
      {!d.canBid && d.you.status !== "DECLINED" && <div className="mt-4 text-sm px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">{d.closedReason}. {d.bid ? "Your last submitted bid is shown below." : "Bids can no longer be submitted."}</div>}
      {d.bid && <div className="mt-4 text-sm px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800">Your bid (version {d.bid.revision}) was received on {new Date(d.bid.submittedAt).toLocaleString()}.{d.canBid ? " You can revise it until the deadline." : ""}</div>}

      <div className="mt-5 bg-white border border-gray-300 rounded-xl p-6 space-y-3">
        {e.description && <p className="text-sm text-gray-800 whitespace-pre-wrap">{e.description}</p>}
        <div className="text-xs text-gray-500 flex flex-wrap gap-x-6 gap-y-1">
          {e.category && <span>Category: {e.category}</span>}{e.requiredDate && <span>Needed by: {new Date(e.requiredDate).toLocaleDateString()}</span>}{e.deliveryLocation && <span>Deliver to: {e.deliveryLocation}</span>}<span>Currency: {e.currency}</span>
        </div>
        {e.terms && <details className="text-xs text-gray-600"><summary className="cursor-pointer">Terms for this request</summary><p className="mt-2 whitespace-pre-wrap">{e.terms}</p></details>}
      </div>

      <h2 className="mt-6 text-sm font-semibold text-gray-900">Your prices</h2>
      <div className="mt-2 bg-white border border-gray-300 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[11px] text-gray-400 border-b border-gray-100"><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right w-40">Unit price ({e.currency})</th><th className="px-3 py-2 text-right">Line total</th></tr></thead>
          <tbody className="divide-y divide-gray-50">
            {e.items.map(i => (
              <tr key={i.id}>
                <td className="px-3 py-2 text-gray-800">{i.description}{i.specification && <p className="text-xs text-gray-400">{i.specification}</p>}</td>
                <td className="px-3 py-2 text-right text-gray-600">{i.quantity}{i.unit ? ` ${i.unit}` : ""}</td>
                <td className="px-3 py-2"><input disabled={!d.canBid} type="number" min="0" step="0.01" value={prices[i.id] ?? ""} onChange={ev => setPrices({ ...prices, [i.id]: ev.target.value })} className={`${input} text-right`} /></td>
                <td className="px-3 py-2 text-right text-gray-700">{(Number(prices[i.id]) || 0) * i.quantity ? ((Number(prices[i.id]) || 0) * i.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}</td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-medium"><td className="px-3 py-2" colSpan={3}>Total</td><td className="px-3 py-2 text-right">{e.currency} {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <label className="text-xs text-gray-500">Lead time (days)<input disabled={!d.canBid} type="number" min="0" value={meta.leadTimeDays} onChange={e => setMeta({ ...meta, leadTimeDays: e.target.value })} className={input} /></label>
        <label className="text-xs text-gray-500">Payment terms<input disabled={!d.canBid} value={meta.paymentTerms} onChange={e => setMeta({ ...meta, paymentTerms: e.target.value })} className={input} placeholder="e.g. Net 45" /></label>
        <label className="text-xs text-gray-500">Bid valid for (days)<input disabled={!d.canBid} type="number" min="1" value={meta.validityDays} onChange={e => setMeta({ ...meta, validityDays: e.target.value })} className={input} /></label>
      </div>

      {e.questions.length > 0 && (
        <div className="mt-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Questions</h2>
          {e.questions.map(q => <label key={q.id} className="block text-xs text-gray-600">{q.text}{q.required && <span className="text-red-500"> *</span>}<textarea disabled={!d.canBid} rows={2} value={answers[q.id] ?? ""} onChange={ev => setAnswers({ ...answers, [q.id]: ev.target.value })} className={input} /></label>)}
        </div>
      )}
      <label className="mt-4 block text-xs text-gray-500">Anything else the buyer should know<textarea disabled={!d.canBid} rows={3} value={meta.notes} onChange={e => setMeta({ ...meta, notes: e.target.value })} className={input} /></label>

      {d.canBid && (
        <div className="mt-5 flex gap-2">
          <button disabled={busy || !complete} onClick={submit} className={`${btn} bg-[#1A2A52] text-white`}>{d.bid ? "Submit revised bid" : "Submit bid"}</button>
          {!d.bid && <button disabled={busy} onClick={() => { const r = prompt("Optional: tell them why you're declining"); if (r !== null) post({ action: "decline", reason: r || undefined }, "You've declined. Thank you for letting them know."); }} className={`${btn} border border-gray-300 text-gray-600`}>Decline to bid</button>}
          {!complete && <span className="text-xs text-gray-400 self-center">Price every item to submit.</span>}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#F7F8FA]"><div className="max-w-3xl mx-auto px-5 py-10">{children}<p className="mt-10 text-[11px] text-gray-300">Secured by Veltriance</p></div></div>;
}
