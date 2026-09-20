"use client";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Data = { organization: string; poNumber: string; supplier: string | null; expectedDelivery: string | null; poId: string; canConfirm: boolean; closedReason: string | null; lines: { id: string; description: string; unit: string | null; remaining: number }[] };

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#F7F8FA]"><div className="max-w-xl mx-auto px-5 py-10">{children}<p className="mt-10 text-[11px] text-gray-300">Secured by Veltriance</p></div></div>;
}

export default function ReceivePage() {
  const { token } = useParams<{ token: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(async () => { const r = await fetch(`/api/public/receive/${token}`); if (!r.ok) { setGone(true); return; } setD(await r.json()); }, [token]);
  useEffect(() => { load(); }, [load]);

  async function confirm() {
    setBusy(true);
    const res = await fetch(`/api/public/receive/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "all_received" }) });
    const r = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: r?.error ?? "That didn't work" }); return; }
    setMsg({ ok: true, text: `Thank you — receipt ${r.receipt?.receiptNumber ?? ""} recorded. Matching invoices will now be released for payment automatically.` }); await load();
  }

  if (gone) return <Shell><h1 className="text-lg font-semibold text-gray-900">This link isn&apos;t valid any more</h1><p className="text-sm text-gray-500 mt-2">It may have expired (links last 14 days). You can record the delivery from the purchase order page in the app.</p></Shell>;
  if (!d) return <Shell><p className="text-sm text-gray-400">Loading…</p></Shell>;
  return (
    <Shell>
      <p className="text-xs text-gray-400">{d.organization}</p>
      <h1 className="text-xl font-semibold text-gray-900">Did {d.poNumber} arrive?</h1>
      <p className="text-sm text-gray-500 mt-1">{d.supplier ? `From ${d.supplier}. ` : ""}{d.expectedDelivery ? `It was due ${new Date(d.expectedDelivery).toLocaleDateString()}.` : ""}</p>
      {msg && <div className={`mt-4 text-sm px-4 py-3 rounded-lg border ${msg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</div>}
      {!d.canConfirm && !msg?.ok && <div className="mt-4 text-sm px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">{d.closedReason}</div>}
      {d.lines.length > 0 && <div className="mt-5 bg-white border border-gray-300 rounded-xl divide-y divide-gray-100">{d.lines.map(l => <div key={l.id} className="px-4 py-3 flex justify-between text-sm"><span className="text-gray-800">{l.description}</span><span className="text-gray-500">{l.remaining}{l.unit ? ` ${l.unit}` : ""} outstanding</span></div>)}</div>}
      {d.canConfirm && (
        <div className="mt-5 space-y-3">
          <button disabled={busy} onClick={confirm} className="w-full text-sm px-5 py-3 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50">{busy ? "Recording…" : "Yes — everything above arrived"}</button>
          <p className="text-xs text-gray-500 text-center">Something missing or damaged? <a href={`/dashboard/purchase-orders/${d.poId}`} className="underline">Record what actually arrived in the app</a> — only accepted goods will be paid for.</p>
        </div>
      )}
    </Shell>
  );
}
