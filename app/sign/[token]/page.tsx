"use client";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Data = {
  organization: string;
  contract: { title: string; contractNumber: string; type: string; status: string; value: string | null; currency: string; endDate: string | null; publishedAt: string | null };
  you: { name: string; party: string; status: string; signedAt: string | null };
  version: number; body: string;
  comments: { id: string; authorType: string; authorName: string; body: string; createdAt: string }[];
  canSign: boolean; canNegotiate: boolean; canComment: boolean;
};
const input = "w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white";
const btn = "text-sm px-4 py-2 rounded-lg disabled:opacity-50";

export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [typedName, setTypedName] = useState(""); const [agree, setAgree] = useState(false);
  const [comment, setComment] = useState("");
  const [edit, setEdit] = useState(false); const [counter, setCounter] = useState(""); const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/public/contracts/${token}`);
    if (!res.ok) { setGone(true); return; }
    const data: Data = await res.json();
    setD(data); setCounter(prev => prev || data.body);
  }, [token]);
  useEffect(() => { load(); }, [load]);

  async function post(payload: object, okText: string) {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/public/contracts/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const r = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: r?.error ?? "That didn't work" }); return false; }
    setMsg({ ok: true, text: okText }); await load(); return true;
  }

  if (gone) return <Shell><h1 className="text-lg font-semibold text-gray-900">This link isn&apos;t valid any more</h1><p className="text-sm text-gray-500 mt-2">It may have been replaced by a newer one, or the agreement is no longer open. Please ask the sender for a fresh link.</p></Shell>;
  if (!d) return <Shell><p className="text-sm text-gray-400">Loading…</p></Shell>;

  const { contract: c, you } = d;
  return (
    <Shell>
      <p className="text-xs text-gray-400">{d.organization}</p>
      <h1 className="text-xl font-semibold text-gray-900">{c.title}</h1>
      <p className="text-xs text-gray-400 mt-1">{c.contractNumber} · version {d.version} · you are signing in as {you.name}</p>

      {msg && <div className={`mt-4 text-sm px-4 py-3 rounded-lg border ${msg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</div>}
      {you.status === "SIGNED" && <div className="mt-4 text-sm px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">You signed this on {you.signedAt && new Date(you.signedAt).toLocaleString()}.{c.status === "ACTIVE" ? " All parties have signed and the agreement is now in force." : " We&apos;ll let you know once everyone has signed."}</div>}
      {c.status === "NEGOTIATION" && <p className="mt-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">This draft is open for review. You can comment or suggest changes below.</p>}

      <div className="mt-5 bg-white border border-gray-300 rounded-xl p-6">
        {edit ? (
          <>
            <p className="text-xs text-gray-500 mb-2">Edit the text below to suggest changes. Your edited version goes back to {d.organization} for review.</p>
            <textarea value={counter} onChange={e => setCounter(e.target.value)} rows={26} className={`${input} font-mono text-xs leading-relaxed`} />
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Briefly explain your changes" className={`${input} mt-2`} />
            <div className="flex gap-2 mt-3">
              <button disabled={busy || counter.trim() === d.body.trim()} onClick={async () => { if (await post({ action: "counter", body: counter, note: note || undefined }, "Your suggested changes were sent.")) setEdit(false); }} className={`${btn} bg-[#1A2A52] text-white`}>Send suggested changes</button>
              <button onClick={() => { setEdit(false); setCounter(d.body); }} className={`${btn} border border-gray-300 text-gray-600`}>Cancel</button>
            </div>
          </>
        ) : <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed">{d.body || "(This draft has no text yet.)"}</pre>}
      </div>
      {d.canNegotiate && !edit && <button onClick={() => setEdit(true)} className={`${btn} mt-3 border border-gray-300 text-gray-700 bg-white`}>Suggest changes to the text</button>}

      {d.comments.length > 0 && (
        <div className="mt-6 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Discussion</p>
          {d.comments.map(m => <div key={m.id} className="bg-white border border-gray-200 rounded-lg p-3"><p className="text-xs text-gray-400">{m.authorName} · {new Date(m.createdAt).toLocaleString()}</p><p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{m.body}</p></div>)}
        </div>
      )}
      {d.canComment && (
        <div className="mt-4 flex gap-2">
          <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Write a comment…" className={input} />
          <button disabled={busy || !comment.trim()} onClick={async () => { if (await post({ action: "comment", body: comment }, "Comment sent.")) setComment(""); }} className={`${btn} border border-gray-300 text-gray-700 bg-white`}>Send</button>
        </div>
      )}

      {d.canSign && (
        <div className="mt-8 bg-white border-2 border-[#1A2A52]/20 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Sign this agreement</h2>
          <p className="text-xs text-gray-500">By typing your full name and signing, you agree that this is your electronic signature and that you accept the agreement above. We record the time, your network address and a fingerprint of this exact text.</p>
          <input value={typedName} onChange={e => setTypedName(e.target.value)} placeholder="Type your full name" className={input} />
          <label className="flex items-start gap-2 text-sm text-gray-700"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-1" />I have read the agreement and agree to be bound by it.</label>
          <div className="flex gap-2">
            <button disabled={busy || typedName.trim().length < 2 || !agree} onClick={() => post({ action: "sign", typedName, agree: true }, "Thank you — your signature has been recorded.")} className={`${btn} bg-[#1A2A52] text-white`}>Sign</button>
            <button disabled={busy} onClick={() => { const reason = prompt("Why are you declining? This goes back to the other party."); if (reason && reason.trim().length >= 3) post({ action: "decline", reason }, "You declined. The agreement has gone back to negotiation."); }} className={`${btn} border border-gray-300 text-gray-600`}>Decline</button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#F7F8FA]"><div className="max-w-3xl mx-auto px-5 py-10">{children}<p className="mt-10 text-[11px] text-gray-300">Secured by Veltriance</p></div></div>;
}
