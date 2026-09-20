"use client";
import { useCallback, useEffect, useState } from "react";
import { Plane } from "lucide-react";

type Data = { delegateId: string | null; until: string | null; candidates: { id: string; name: string; role: string }[] };

/** Out of office: while it's on, approvals addressed to me also go to (and can be decided by) my delegate. */
export function OutOfOfficeCard() {
  const [d, setD] = useState<Data | null>(null);
  const [pick, setPick] = useState(""); const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => { const r = await fetch("/api/user/delegation"); if (r.ok) setD(await r.json()); }, []);
  useEffect(() => { load(); }, [load]);

  async function save(clear = false) {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/user/delegation", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clear ? { delegateId: null, until: null } : { delegateId: pick, until }) });
    const r = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: r?.error ?? "Could not save" }); return; }
    setMsg({ ok: true, text: clear ? "Out of office turned off." : "Saved — your approvals will now also go to your delegate." }); setPick(""); setUntil(""); load();
  }

  if (!d) return null;
  const name = d.candidates.find(c => c.id === d.delegateId)?.name;
  const input = "text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white";
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-6">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><Plane className="size-3.5" />Out of office</p>
      {d.delegateId && d.until ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-sm text-gray-700">Your approvals also go to <strong>{name ?? "your delegate"}</strong> until {new Date(d.until).toLocaleDateString()}.</p>
          <button disabled={busy} onClick={() => save(true)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Turn off</button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="text-xs text-gray-500">Who covers for you<br /><select value={pick} onChange={e => setPick(e.target.value)} className={`${input} mt-1`}><option value="">Choose a colleague…</option>{d.candidates.map(c => <option key={c.id} value={c.id}>{c.name} — {c.role.toLowerCase()}</option>)}</select></label>
          <label className="text-xs text-gray-500">Until<br /><input type="date" value={until} onChange={e => setUntil(e.target.value)} className={`${input} mt-1`} /></label>
          <button disabled={busy || !pick || !until} onClick={() => save()} className="text-xs px-3 py-2 rounded-lg bg-[#1A2A52] text-white disabled:opacity-50">Set out of office</button>
          <p className="text-[11px] text-gray-400 basis-full">So nothing waits while you&apos;re away: they&apos;re emailed your approvals and can decide them, and it&apos;s recorded that they did so on your behalf.</p>
        </div>
      )}
      {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}
