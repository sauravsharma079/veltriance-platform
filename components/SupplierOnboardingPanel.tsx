"use client";
import { useCallback, useEffect, useState } from "react";
import { Copy, Check, Send, ShieldCheck, Sparkles } from "lucide-react";

type Item = { key: string; label: string; group: string; status: "done" | "missing" | "invalid"; detail?: string };
type Rec = { decision: "approve" | "request_changes" | "investigate"; reasoning: string; at: string; by: string; riskLevel: string | null };
type Status = { status: string; stage: string | null; hasEmail: boolean; invitedAt: string | null; submittedAt: string | null; reminders: number; riskLevel: string | null; recommendation: Rec | null; checklist: { items: Item[]; percent: number; missing: Item[]; readyForReview: boolean } };
type Invite = { link: string; emailed: boolean; emailNote?: string };

const REC_STYLE = { approve: "bg-emerald-50 border-emerald-200 text-emerald-900", request_changes: "bg-amber-50 border-amber-200 text-amber-900", investigate: "bg-red-50 border-red-200 text-red-900" };
const REC_LABEL = { approve: "Recommends approving", request_changes: "Recommends asking for changes", investigate: "Recommends investigating before any decision" };

/** The buyer's view of a new vendor's onboarding: progress, what's missing, the agent's advice, and the actions. */
export function SupplierOnboardingPanel({ supplierId, onChanged }: { supplierId: string; onChanged?: () => void }) {
  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/suppliers/${supplierId}/onboarding-status`);
    if (res.ok) setS(await res.json());
  }, [supplierId]);
  useEffect(() => { load(); }, [load]);

  async function sendLink() {
    setBusy("send"); setError(null);
    const res = await fetch(`/api/suppliers/${supplierId}/onboarding-invite`, { method: "POST" });
    const d = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) { setError(d?.error ?? "Could not send the link"); return; }
    setInvite(d.invite); load();
  }
  async function approve() {
    if (!confirm("Approve this supplier? They'll become Active and can be contracted and ordered from.")) return;
    setBusy("approve"); setError(null);
    const res = await fetch(`/api/suppliers/${supplierId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ACTIVE", onboardingStage: "ACTIVE" }) });
    const d = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) { setError(d?.error ?? "Could not approve"); return; }
    await load(); onChanged?.();
  }

  if (!s || s.status !== "PENDING_APPROVAL") return null;
  const { checklist: cl } = s;
  const groups = Array.from(new Set(cl.missing.map(m => m.group)));
  return (
    <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><ShieldCheck className="size-3.5" />New vendor onboarding</p>
          <p className="text-sm text-gray-700 mt-1">{cl.percent}% of the required information is on file{cl.readyForReview ? " — ready for review." : `, ${cl.missing.length} item${cl.missing.length > 1 ? "s" : ""} to go.`}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {s.submittedAt ? `Submitted by the vendor ${new Date(s.submittedAt).toLocaleDateString()}` : s.invitedAt ? `Link sent ${new Date(s.invitedAt).toLocaleDateString()}${s.reminders ? ` · ${s.reminders} reminder${s.reminders > 1 ? "s" : ""}` : ""} · not submitted yet` : "The vendor hasn't been sent their onboarding link yet"}
          </p>
        </div>
        <div className="flex gap-2">
          <button disabled={!!busy || !s.hasEmail || !!s.submittedAt} title={!s.hasEmail ? "Add a contact email for this supplier first" : s.submittedAt ? "They've already submitted" : undefined} onClick={sendLink} className="flex items-center gap-1.5 text-xs font-semibold text-[#1A2A52] border border-[#1A2A52]/20 px-3 py-1.5 rounded-xl hover:bg-[#1A2A52]/5 disabled:opacity-50"><Send className="size-3.5" />{busy === "send" ? "Sending…" : s.invitedAt ? "Re-send link" : "Send onboarding link"}</button>
          <button disabled={!!busy || !cl.readyForReview} title={!cl.readyForReview ? "Complete the checklist first" : undefined} onClick={approve} className="text-xs font-semibold bg-emerald-700 text-white px-3 py-1.5 rounded-xl hover:bg-emerald-800 disabled:opacity-40">{busy === "approve" ? "Approving…" : "Approve supplier"}</button>
        </div>
      </div>

      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#1A2A52]" style={{ width: `${cl.percent}%` }} /></div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">{error}</div>}

      {invite && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1.5">
          <p className="text-xs font-medium text-emerald-800">{invite.emailed ? "Emailed to the vendor." : `Not emailed (${invite.emailNote ?? "unknown reason"}) — copy the link and send it yourself.`} It isn&apos;t shown again; re-sending issues a new one.</p>
          <div className="flex gap-2"><input readOnly value={invite.link} className="flex-1 min-w-0 text-[11px] border border-gray-200 rounded px-2 py-1 bg-white font-mono" />
            <button onClick={() => { navigator.clipboard.writeText(invite.link); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-xs px-2 py-1 rounded border border-gray-200 bg-white">{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</button></div>
        </div>
      )}

      {s.recommendation && (
        <div className={`border rounded-xl p-3 ${REC_STYLE[s.recommendation.decision]}`}>
          <p className="text-xs font-semibold flex items-center gap-1.5"><Sparkles className="size-3.5" />{REC_LABEL[s.recommendation.decision]}</p>
          <p className="text-xs mt-1 whitespace-pre-wrap">{s.recommendation.reasoning}</p>
          <p className="text-[10px] opacity-70 mt-1.5">{s.recommendation.by} · {new Date(s.recommendation.at).toLocaleDateString()} · advice only — the approval is yours.</p>
        </div>
      )}

      {cl.missing.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
          {groups.map(g => (
            <div key={g}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{g}</p>
              {cl.missing.filter(m => m.group === g).map(m => <p key={m.key} className="text-xs text-gray-600"><span className={m.status === "invalid" ? "text-red-500" : "text-amber-500"}>●</span> {m.label}{m.detail ? <span className="text-gray-400"> — {m.detail}</span> : ""}</p>)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
