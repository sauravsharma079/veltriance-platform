"use client";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Copy, Check, Loader2, Trash2, Send } from "lucide-react";
import { ActivityLog } from "@/components/ActivityLog";
import { diffLines } from "@/lib/diff";
import { STATUS_STYLE, statusLabel } from "@/lib/contract-ui";

type Sig = { id: string; party: string; name: string; email: string; title: string | null; status: string; signedName: string | null; signedAt: string | null; signedVersion: number | null; signedDocHash: string | null; declineReason: string | null; invitedAt: string | null };
type Comment = { id: string; authorType: string; authorName: string; body: string; internal: boolean; createdAt: string; versionNumber: number | null };
type Ver = { versionNumber: number; changeNote: string | null; source: string; createdByName: string | null; createdAt: string };
type Contract = { id: string; contractNumber: string; title: string; type: string; status: string; description: string | null; value: string | null; currency: string; startDate: string | null; endDate: string | null; autoRenew: boolean; noticeDays: number; currentVersion: number; ownerId: string; owner: { id: string; name: string }; supplier: { id: string; name: string; contactEmail: string | null; contactName: string | null } | null; signatories: Sig[]; comments: Comment[]; versions: Ver[]; approvedAt: string | null; publishedAt: string | null; terminationReason: string | null };
type Invite = { signatoryId: string; name: string; email: string; party: string; link: string; emailed: boolean; emailNote?: string };

const TABS = ["Document", "Negotiation", "Signatures", "Details"] as const;
const EDITABLE = ["DRAFT", "NEGOTIATION"];
const input = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white";
const btn = "text-xs px-3 py-1.5 rounded-lg disabled:opacity-50";
const primary = `${btn} bg-[#1A2A52] text-white hover:bg-[#14203f]`;
const ghost = `${btn} border border-gray-200 text-gray-600 hover:bg-gray-50`;

export default function ContractPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const [c, setC] = useState<Contract | null>(null);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [meId, setMeId] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Document");
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [showDiff, setShowDiff] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [aiInstruction, setAiInstruction] = useState("");
  const [comment, setComment] = useState(""); const [internal, setInternal] = useState(true);
  const [sig, setSig] = useState({ party: "SUPPLIER", name: "", email: "", title: "" });
  const [copied, setCopied] = useState<string | null>(null);
  const autoDrafted = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/contracts/${id}`);
    if (!res.ok) { setError((await res.json().catch(() => null))?.error ?? "Could not load the contract"); return; }
    const d = await res.json();
    setC(d.contract); setBodies(d.bodies);
    setDraft(prev => (prev === "" || prev === bodiesRef.current[d.contract.currentVersion]) ? (d.bodies[d.contract.currentVersion] ?? "") : prev);
    bodiesRef.current = d.bodies;
  }, [id]);
  const bodiesRef = useRef<Record<string, string>>({});
  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch("/api/user/profile").then(r => r.json()).then(d => setMeId(d?.profile?.id ?? d?.user?.id ?? d?.id ?? null)).catch(() => {}); }, []);

  const current = c ? (bodies[c.currentVersion] ?? "") : "";
  const previous = c && c.currentVersion > 1 ? bodies[c.currentVersion - 1] : undefined;
  const dirty = c ? draft !== current : false;
  const editable = !!c && EDITABLE.includes(c.status);
  const diff = useMemo(() => (showDiff && previous !== undefined ? diffLines(previous, current) : null), [showDiff, previous, current]);

  async function call(key: string, url: string, method: string, body?: unknown, ok?: (d: any) => void) { // eslint-disable-line @typescript-eslint/no-explicit-any
    setBusy(key); setError(null); setInfo(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const d = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) { setError(d?.error ?? "That didn't work"); return false; }
    ok?.(d); await load(); return true;
  }

  const saveVersion = () => call("save", `/api/contracts/${id}/versions`, "POST", { body: draft, changeNote: note || undefined }, () => { setNote(""); setInfo("Saved as a new version."); });
  const transition = (action: string, reason?: string) => call(action, `/api/contracts/${id}/transition`, "POST", { action, reason }, d => { if (d.invites?.length) { setInvites(d.invites); setTab("Signatures"); } });
  const ask = (reason: string) => { const r = prompt(reason); return r?.trim() || null; };

  async function runAi(instruction?: string) {
    setBusy("ai"); setError(null); setInfo(null);
    const res = await fetch("/api/agents/contract-negotiator/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: { contractId: id, instruction } }) });
    const d = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) { setError(d?.error ?? "The assistant could not run"); return; }
    setInfo(d.run.status === "WAITING_HUMAN" ? "The assistant has a proposal waiting for your approval in Agents → Waiting for your approval." : d.run.status === "FAILED" ? `The assistant failed: ${d.run.error}` : `Assistant: ${d.run.summary}`);
    await load();
    setDraft(""); // pick up any newly saved version
  }

  // "Draft with AI" chosen on the create screen: start it once, on arrival.
  useEffect(() => {
    if (c && search.get("draft") === "1" && !autoDrafted.current && current === "" && c.status === "DRAFT") {
      autoDrafted.current = true; runAi("Write a complete first draft of this agreement.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c]);

  function copy(link: string, key: string) { navigator.clipboard.writeText(link); setCopied(key); setTimeout(() => setCopied(null), 1500); }

  if (error && !c) return <div className="p-8 text-sm text-red-600">{error}</div>;
  if (!c) return <div className="p-8 text-sm text-gray-400">Loading…</div>;

  const isOwner = meId === c.ownerId;
  const suppliers = c.signatories.filter(s => s.party === "SUPPLIER");
  return (
    <div className="p-8 max-w-5xl space-y-5">
      <div>
        <Link href="/dashboard/contracts" className="text-xs text-gray-400 hover:underline">← Contracts</Link>
        <div className="flex items-start justify-between gap-4 mt-1">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{c.title}</h1>
            <p className="text-xs text-gray-400 mt-1">{c.contractNumber} · {c.type.replace("_", " ")} · {c.supplier?.name ?? "No supplier"} · owner {c.owner.name} · v{c.currentVersion}</p>
          </div>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[c.status]}`}>{statusLabel(c.status)}</span>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl">{error}</div>}
      {info && <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs px-4 py-3 rounded-xl">{info}</div>}

      {/* Lifecycle actions */}
      <div className="flex flex-wrap gap-2">
        {c.status === "DRAFT" && <button disabled={!!busy} onClick={() => transition("share")} className={ghost}>Share with supplier</button>}
        {["DRAFT", "NEGOTIATION"].includes(c.status) && <button disabled={!!busy || dirty} title={dirty ? "Save your changes first" : undefined} onClick={() => transition("submit")} className={primary}>Submit for approval</button>}
        {c.status === "PENDING_APPROVAL" && (isOwner
          ? <span className="text-xs text-gray-400 self-center">You own this contract — someone else must approve it.</span>
          : <button disabled={!!busy} onClick={() => transition("approve")} className={primary}>Approve &amp; send for signature</button>)}
        {c.status === "PENDING_APPROVAL" && <button disabled={!!busy} onClick={() => { const r = ask("Why are you sending it back?"); if (r) transition("return", r); }} className={ghost}>Return for changes</button>}
        {["DRAFT", "NEGOTIATION", "PENDING_APPROVAL", "PENDING_SIGNATURE"].includes(c.status) && <button disabled={!!busy} onClick={() => confirm("Cancel this contract?") && transition("cancel")} className={ghost}>Cancel</button>}
        {c.status === "ACTIVE" && <button disabled={!!busy} onClick={() => { const r = ask("Reason for terminating"); if (r) transition("terminate", r); }} className={ghost}>Terminate</button>}
      </div>

      {/* Links returned by share / approve — the only time they're shown */}
      {invites.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
          <p className="text-xs font-medium text-emerald-800">Personal links issued. Copy any that weren&apos;t emailed — for security they aren&apos;t shown again (you can re-issue one anytime).</p>
          {invites.map(i => (
            <div key={i.signatoryId} className="flex items-center gap-2 text-xs">
              <span className="w-40 truncate text-gray-700">{i.name} <span className="text-gray-400">({i.party.toLowerCase()})</span></span>
              <span className={i.emailed ? "text-emerald-700" : "text-amber-700"}>{i.emailed ? "emailed" : "not emailed"}</span>
              <input readOnly value={i.link} className="flex-1 min-w-0 text-[11px] border border-gray-200 rounded px-2 py-1 bg-white font-mono" />
              <button onClick={() => copy(i.link, i.signatoryId)} className={ghost}>{copied === i.signatoryId ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</button>
            </div>
          ))}
          {invites.some(i => !i.emailed) && <p className="text-[11px] text-emerald-700">{invites.find(i => !i.emailed)?.emailNote}</p>}
        </div>
      )}

      <div className="border-b border-gray-200 flex gap-5">
        {TABS.map(t => <button key={t} onClick={() => setTab(t)} className={`pb-2 text-sm ${tab === t ? "border-b-2 border-[#1A2A52] text-gray-900 font-medium" : "text-gray-400"}`}>{t}{t === "Signatures" && c.signatories.length > 0 ? ` (${c.signatories.filter(s => s.status === "SIGNED").length}/${c.signatories.length})` : ""}</button>)}
      </div>

      {tab === "Document" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {editable && (
              <>
                <input value={aiInstruction} onChange={e => setAiInstruction(e.target.value)} placeholder={current ? "Optional: tell the assistant what to focus on…" : "Optional: anything the first draft should include…"} className={`${input} max-w-sm`} />
                <button disabled={!!busy || dirty} title={dirty ? "Save your changes first" : undefined} onClick={() => runAi(aiInstruction || (current ? undefined : "Write a complete first draft of this agreement."))} className={primary}>
                  {busy === "ai" ? <Loader2 className="size-3.5 animate-spin inline mr-1" /> : <Sparkles className="size-3.5 inline mr-1" />}{current ? "Review against playbook" : "Draft with AI"}
                </button>
              </>
            )}
            {previous !== undefined && <button onClick={() => setShowDiff(s => !s)} className={ghost}>{showDiff ? "Hide" : "Show"} changes from v{c.currentVersion - 1}</button>}
          </div>

          {showDiff && (diff ? (
            <div className="bg-white border border-gray-200 rounded-xl p-4 font-mono text-xs leading-relaxed max-h-[28rem] overflow-auto">
              {diff.map((l, i) => <div key={i} className={l.type === "add" ? "bg-emerald-50 text-emerald-800" : l.type === "del" ? "bg-red-50 text-red-700 line-through" : "text-gray-500"}>{l.type === "add" ? "+ " : l.type === "del" ? "− " : "  "}{l.text || " "}</div>)}
            </div>
          ) : <p className="text-xs text-gray-400">This version is too large to compare here.</p>)}

          {!showDiff && (
            <textarea value={draft} onChange={e => setDraft(e.target.value)} readOnly={!editable} rows={24} placeholder={editable ? "Write the contract here, or use Draft with AI…" : ""} className={`${input} font-mono text-xs leading-relaxed ${editable ? "" : "bg-gray-50"}`} />
          )}
          {!editable && <p className="text-xs text-gray-400">The text is locked while a contract is {statusLabel(c.status)}.</p>}
          {editable && !showDiff && (
            <div className="flex gap-2 items-center">
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="What changed? (optional)" className={`${input} max-w-sm`} />
              <button disabled={!dirty || !draft.trim() || !!busy} onClick={saveVersion} className={primary}>Save as new version</button>
              {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
            </div>
          )}
        </div>
      )}

      {tab === "Negotiation" && (
        <div className="grid md:grid-cols-3 gap-5">
          <div className="md:col-span-2 space-y-3">
            {c.comments.length === 0 && <p className="text-sm text-gray-400 bg-white border border-gray-200 rounded-xl p-6 text-center">No comments yet.</p>}
            {c.comments.map(m => (
              <div key={m.id} className={`bg-white border rounded-xl p-3 ${m.internal ? "border-amber-200" : "border-gray-200"}`}>
                <p className="text-xs text-gray-400">{m.authorName} · {m.authorType.toLowerCase()} · {new Date(m.createdAt).toLocaleString()}{m.internal && <span className="ml-2 text-amber-600">internal</span>}</p>
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{m.body}</p>
              </div>
            ))}
            <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
              <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Add a comment…" className={input} />
              <div className="flex items-center gap-3">
                <button disabled={!comment.trim() || !!busy} onClick={() => call("comment", `/api/contracts/${id}/comments`, "POST", { body: comment, internal }, () => setComment(""))} className={primary}><Send className="size-3.5 inline mr-1" />Post</button>
                <label className="text-xs text-gray-500 flex items-center gap-1"><input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)} />Internal only (hidden from supplier)</label>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Versions</p>
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {c.versions.map(v => (
                <div key={v.versionNumber} className="p-3 text-xs">
                  <p className="text-gray-900 font-medium">v{v.versionNumber} <span className="font-normal text-gray-400">· {v.source.toLowerCase()} · {v.createdByName}</span></p>
                  <p className="text-gray-500 mt-0.5">{v.changeNote ?? "—"}</p>
                  <p className="text-gray-300 mt-0.5">{new Date(v.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "Signatures" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {c.signatories.length === 0 && <p className="p-6 text-center text-sm text-gray-400">Add who needs to sign — at least one from each side.</p>}
            {c.signatories.map(s => (
              <div key={s.id} className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{s.name} <span className="text-xs font-normal text-gray-400">· {s.party.toLowerCase()}{s.title ? ` · ${s.title}` : ""}</span></p>
                  <p className="text-xs text-gray-400">{s.email}</p>
                  {s.status === "SIGNED" && <p className="text-xs text-emerald-700 mt-1">Signed as “{s.signedName}” on {s.signedAt && new Date(s.signedAt).toLocaleString()} (v{s.signedVersion}) · fingerprint {s.signedDocHash?.slice(0, 12)}…</p>}
                  {s.declineReason && s.status === "PENDING" && <p className="text-xs text-red-600 mt-1">Declined: {s.declineReason}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.status === "SIGNED" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{s.status.toLowerCase()}</span>
                  {s.status !== "SIGNED" && (c.status === "PENDING_SIGNATURE" || (c.status === "NEGOTIATION" && s.party === "SUPPLIER")) && (
                    <button disabled={!!busy} onClick={() => call(`inv-${s.id}`, `/api/contracts/${id}/signatories/${s.id}/invite`, "POST", undefined, d => setInvites([d.invite]))} className={ghost}>{s.invitedAt ? "Re-issue link" : "Send link"}</button>
                  )}
                  {["DRAFT", "NEGOTIATION", "PENDING_APPROVAL"].includes(c.status) && <button onClick={() => call(`del-${s.id}`, `/api/contracts/${id}/signatories/${s.id}`, "DELETE")} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="size-3.5" /></button>}
                </div>
              </div>
            ))}
          </div>
          {["DRAFT", "NEGOTIATION", "PENDING_APPROVAL"].includes(c.status) && (
            <form onSubmit={async e => { e.preventDefault(); if (await call("addsig", `/api/contracts/${id}/signatories`, "POST", { ...sig, title: sig.title || undefined })) setSig({ ...sig, name: "", email: "", title: "" }); }} className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
              <label className="text-xs text-gray-500">Side<select value={sig.party} onChange={e => setSig({ ...sig, party: e.target.value })} className={input}><option value="SUPPLIER">Supplier</option><option value="BUYER">Our company</option></select></label>
              <label className="text-xs text-gray-500">Name<input required value={sig.name} onChange={e => setSig({ ...sig, name: e.target.value })} className={input} /></label>
              <label className="text-xs text-gray-500">Email<input required type="email" value={sig.email} onChange={e => setSig({ ...sig, email: e.target.value })} className={input} /></label>
              <label className="text-xs text-gray-500">Title<input value={sig.title} onChange={e => setSig({ ...sig, title: e.target.value })} className={input} /></label>
              <button disabled={!!busy} className={primary}>Add signatory</button>
              {sig.party === "SUPPLIER" && suppliers.length === 0 && c.supplier?.contactEmail && (
                <button type="button" onClick={() => setSig({ party: "SUPPLIER", name: c.supplier?.contactName ?? c.supplier!.name, email: c.supplier!.contactEmail!, title: "" })} className="text-[11px] text-[#1A2A52] underline text-left col-span-2">Use {c.supplier.name}&apos;s contact on file</button>
              )}
            </form>
          )}
        </div>
      )}

      {tab === "Details" && (
        <div className="grid md:grid-cols-2 gap-5">
          <div className="bg-white border border-gray-200 rounded-xl p-5 text-sm space-y-2">
            {[["Value", c.value ? `${c.currency} ${Number(c.value).toLocaleString()}` : "—"], ["Start", c.startDate ? new Date(c.startDate).toLocaleDateString() : "—"], ["End", c.endDate ? new Date(c.endDate).toLocaleDateString() : "—"],
              ["Notice period", `${c.noticeDays} days`], ["Auto-renews", c.autoRenew ? "Yes" : "No"], ["Approved", c.approvedAt ? new Date(c.approvedAt).toLocaleDateString() : "—"], ["Published", c.publishedAt ? new Date(c.publishedAt).toLocaleDateString() : "—"],
              ...(c.terminationReason ? [["Termination reason", c.terminationReason]] : [])].map(([k, v]) => <div key={k} className="flex justify-between gap-4"><span className="text-gray-400">{k}</span><span className="text-gray-800 text-right">{v}</span></div>)}
            {c.description && <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">{c.description}</p>}
          </div>
          <ActivityLog entity="CONTRACT" entityId={c.id} title="Activity" />
        </div>
      )}
    </div>
  );
}
