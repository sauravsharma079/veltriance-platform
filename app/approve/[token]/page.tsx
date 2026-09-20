"use client";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Data = {
  organization: string; approver: string; canDecide: boolean; closedReason: string | null;
  requisition: { number: string; title: string; requestor: string; amount: number; currency: string; status: string; category: string | null; department: string | null; justification: string | null; neededBy: string | null; deliveryLocation: string | null; policyException: boolean; policyExceptionNote: string | null; lines: { description: string; quantity: number; unitPrice: number; total: number; supplier: string | null }[] };
};
const btn = "text-sm px-5 py-2.5 rounded-lg disabled:opacity-50";

export default function ApprovePage() {
  const { token } = useParams<{ token: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [gone, setGone] = useState(false);
  const [comment, setComment] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/public/approve/${token}`);
    if (!res.ok) { setGone(true); return; }
    setD(await res.json());
  }, [token]);
  useEffect(() => { load(); }, [load]);

  async function decide(decision: "APPROVE" | "REJECT") {
    setBusy(true);
    const res = await fetch(`/api/public/approve/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, comment: comment || undefined }) });
    const r = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) { setDone({ ok: false, text: r?.error ?? "That didn't work" }); return; }
    setDone({ ok: true, text: decision === "APPROVE" ? "Approved — thank you. The requester has been told and the process continues automatically." : "Rejected. The requester has been told and can revise and resubmit." });
    await load();
  }

  if (gone) return <Shell><h1 className="text-lg font-semibold text-gray-900">This link isn&apos;t valid any more</h1><p className="text-sm text-gray-500 mt-2">It may have expired (links last 5 days) or been tampered with. Open the app to find the request under &ldquo;My approvals&rdquo;.</p></Shell>;
  if (!d) return <Shell><p className="text-sm text-gray-400">Loading…</p></Shell>;
  const r = d.requisition;
  const fmt = (n: number) => `${r.currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return (
    <Shell>
      <p className="text-xs text-gray-400">{d.organization} · approval for {d.approver}</p>
      <h1 className="text-xl font-semibold text-gray-900">{r.title}</h1>
      <p className="text-xs text-gray-400 mt-1">{r.number} · requested by {r.requestor}</p>

      {done && <div className={`mt-4 text-sm px-4 py-3 rounded-lg border ${done.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`}>{done.text}</div>}
      {!d.canDecide && !done?.ok && <div className="mt-4 text-sm px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">{d.closedReason}</div>}
      {r.policyException && <div className="mt-4 text-sm px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-800">⚠ Flagged as a policy exception{r.policyExceptionNote ? `: ${r.policyExceptionNote}` : ""}</div>}

      <div className="mt-5 bg-white border border-gray-300 rounded-xl p-6 space-y-3">
        <p className="text-2xl font-semibold text-gray-900">{fmt(r.amount)}</p>
        <div className="text-xs text-gray-500 flex flex-wrap gap-x-6 gap-y-1">{r.category && <span>Category: {r.category}</span>}{r.department && <span>Department: {r.department}</span>}{r.neededBy && <span>Needed by: {new Date(r.neededBy).toLocaleDateString()}</span>}{r.deliveryLocation && <span>Deliver to: {r.deliveryLocation}</span>}</div>
        {r.justification && <p className="text-sm text-gray-700 whitespace-pre-wrap"><span className="text-gray-400">Why: </span>{r.justification}</p>}
      </div>

      <div className="mt-4 bg-white border border-gray-300 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[11px] text-gray-400 border-b border-gray-100"><th className="px-4 py-2">Item</th><th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-right">Unit price</th><th className="px-4 py-2 text-right">Total</th></tr></thead>
          <tbody className="divide-y divide-gray-50">{r.lines.map((l, i) => <tr key={i}><td className="px-4 py-2 text-gray-800">{l.description}{l.supplier && <p className="text-[11px] text-gray-400">{l.supplier}</p>}</td><td className="px-4 py-2 text-right text-gray-600">{l.quantity}</td><td className="px-4 py-2 text-right text-gray-600">{l.unitPrice.toLocaleString()}</td><td className="px-4 py-2 text-right text-gray-800">{l.total.toLocaleString()}</td></tr>)}</tbody>
        </table>
      </div>

      {d.canDecide && !done?.ok && (
        <div className="mt-5 space-y-3">
          {rejecting && <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Why are you rejecting this? (the requester will see it)" className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white" />}
          {!rejecting && <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Optional comment" className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white" />}
          <div className="flex gap-3">
            {!rejecting && <button disabled={busy} onClick={() => decide("APPROVE")} className={`${btn} bg-emerald-700 text-white hover:bg-emerald-800`}>Approve</button>}
            {!rejecting ? <button disabled={busy} onClick={() => setRejecting(true)} className={`${btn} border border-gray-300 text-gray-700 bg-white`}>Reject…</button>
              : <><button disabled={busy || comment.trim().length < 3} onClick={() => decide("REJECT")} className={`${btn} bg-red-700 text-white`}>Confirm rejection</button><button onClick={() => { setRejecting(false); setComment(""); }} className={`${btn} border border-gray-300 text-gray-700 bg-white`}>Back</button></>}
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#F7F8FA]"><div className="max-w-2xl mx-auto px-5 py-10">{children}<p className="mt-10 text-[11px] text-gray-300">Secured by Veltriance</p></div></div>;
}
