"use client";
import { useCallback, useEffect, useState } from "react";
import { PackageCheck, AlertTriangle } from "lucide-react";

type Line = { id: string; description: string; unit: string | null; ordered: number; received: number; remaining: number };
type Receipt = { id: string; receiptNumber: string; receivedAt: string; receivedBy: string; deliveryNote: string | null; notes: string | null; lines: { poLineId: string; accepted: number; rejected: number; reason: string | null }[] };
type Data = { poStatus: string; canReceive: boolean; lines: Line[]; receipts: Receipt[] };

/** Goods receipt for a purchase order: what's arrived, what's outstanding, and a form to record a delivery. */
export function PoReceiving({ poId, onReceived }: { poId: string; onReceived?: () => void }) {
  const [d, setD] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const [acc, setAcc] = useState<Record<string, string>>({});
  const [rej, setRej] = useState<Record<string, string>>({});
  const [why, setWhy] = useState<Record<string, string>>({});
  const [note, setNote] = useState(""); const [dn, setDn] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/purchase-orders/${poId}/receipts`);
    if (res.ok) setD(await res.json());
  }, [poId]);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    const lines = d!.lines.map(l => ({ poLineId: l.id, accepted: Number(acc[l.id] || 0), rejected: Number(rej[l.id] || 0), reason: why[l.id] || undefined })).filter(l => l.accepted > 0 || l.rejected > 0);
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/purchase-orders/${poId}/receipts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines, deliveryNote: dn || undefined, notes: note || undefined }) });
    const r = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: r?.error ?? "Could not record the receipt" }); return; }
    setMsg({ ok: true, text: `Recorded ${r.receipt.receiptNumber}.${r.invoicesNowClear ? ` ${r.invoicesNowClear} held invoice(s) now match and were released.` : ""}` });
    setAcc({}); setRej({}); setWhy({}); setNote(""); setDn(""); setOpen(false);
    await load(); onReceived?.();
  }

  if (!d || !["SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED", "RECEIVED"].includes(d.poStatus)) return null;
  const input = "w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-right";
  const anyRejected = d.lines.some(l => Number(rej[l.id] || 0) > 0);
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><PackageCheck className="size-4" />Goods receipt</p>
        {d.canReceive && <button onClick={() => setOpen(o => !o)} className="text-xs px-3 py-1.5 rounded-lg bg-[#1A2A52] text-white hover:bg-[#14203f]">{open ? "Cancel" : "Receive goods"}</button>}
      </div>
      {msg && <div className={`text-xs px-3 py-2 rounded-lg border ${msg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</div>}

      <table className="w-full text-sm">
        <thead><tr className="text-left text-[11px] text-gray-400 border-b border-gray-100"><th className="py-2">Item</th><th className="py-2 text-right">Ordered</th><th className="py-2 text-right">Received</th><th className="py-2 text-right">Outstanding</th>{open && <><th className="py-2 w-28 text-right">Accept now</th><th className="py-2 w-28 text-right">Reject</th></>}</tr></thead>
        <tbody className="divide-y divide-gray-50">
          {d.lines.map(l => (
            <tr key={l.id}>
              <td className="py-2 text-gray-800">{l.description}</td>
              <td className="py-2 text-right text-gray-600">{l.ordered}{l.unit ? ` ${l.unit}` : ""}</td>
              <td className="py-2 text-right text-gray-600">{l.received}</td>
              <td className={`py-2 text-right ${l.remaining > 0 ? "text-amber-700" : "text-emerald-700"}`}>{l.remaining > 0 ? l.remaining : "done"}</td>
              {open && <>
                <td className="py-1"><input type="number" min="0" max={l.remaining} step="0.01" disabled={l.remaining === 0} value={acc[l.id] ?? ""} onChange={e => setAcc({ ...acc, [l.id]: e.target.value })} className={input} placeholder={l.remaining > 0 ? String(l.remaining) : ""} /></td>
                <td className="py-1"><input type="number" min="0" step="0.01" value={rej[l.id] ?? ""} onChange={e => setRej({ ...rej, [l.id]: e.target.value })} className={input} /></td>
              </>}
            </tr>
          ))}
        </tbody>
      </table>

      {open && (
        <div className="space-y-3 border-t border-gray-100 pt-4">
          {anyRejected && d.lines.filter(l => Number(rej[l.id] || 0) > 0).map(l => (
            <label key={l.id} className="block text-xs text-gray-500">Why was &ldquo;{l.description}&rdquo; rejected?<input value={why[l.id] ?? ""} onChange={e => setWhy({ ...why, [l.id]: e.target.value })} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white" placeholder="e.g. Damaged in transit" /></label>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-gray-500">Delivery note / challan no.<input value={dn} onChange={e => setDn(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white" /></label>
            <label className="text-xs text-gray-500">Notes<input value={note} onChange={e => setNote(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white" /></label>
          </div>
          <p className="text-[11px] text-gray-400 flex items-center gap-1"><AlertTriangle className="size-3" />Only accepted quantity counts as received and can be invoiced. Rejected goods are recorded but never paid for.</p>
          <button disabled={busy} onClick={submit} className="text-sm px-4 py-2 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50">{busy ? "Recording…" : "Record receipt"}</button>
        </div>
      )}

      {d.receipts.length > 0 && (
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Receipts</p>
          {d.receipts.map(r => (
            <p key={r.id} className="text-xs text-gray-600">
              <span className="font-medium text-gray-800">{r.receiptNumber}</span> · {new Date(r.receivedAt).toLocaleString()} · {r.receivedBy}{r.deliveryNote ? ` · DN ${r.deliveryNote}` : ""} — {r.lines.map(l => `${d.lines.find(x => x.id === l.poLineId)?.description ?? "item"}: ${l.accepted} accepted${l.rejected ? `, ${l.rejected} rejected (${l.reason})` : ""}`).join("; ")}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
