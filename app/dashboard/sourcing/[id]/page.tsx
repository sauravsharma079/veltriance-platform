"use client";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Copy, Check, Loader2, Trash2, Plus, Trophy } from "lucide-react";
import { ActivityLog } from "@/components/ActivityLog";
import { SOURCING_STATUS_STYLE } from "@/lib/contract-ui";

type Item = { id?: string; description: string; quantity: number; unit: string | null; specification: string | null; targetPrice: number | string | null };
type Question = { id: string; text: string; required: boolean };
type Line = { itemId: string; unitPrice: string; leadTimeDays: number | null };
type Bid = { totalAmount: string; leadTimeDays: number | null; paymentTerms: string | null; validityDays: number | null; notes: string | null; revision: number; submittedAt: string; lines: Line[]; answers: Record<string, string> | null };
type Invite = { id: string; name: string; email: string; status: string; supplierId: string | null; declineReason: string | null; supplier: { id?: string; status?: string; onboardingStage?: string | null; riskLevel: string | null; rating: number | null } | null; bid: Bid | null };
type Score = { inviteId: string; score: number; rank: number; isLowest: boolean; priceScore: number };
type Evaluation = { summary: string; recommendedInviteId: string; notes: { inviteId: string; note: string }[]; by: string };
type EventT = { id: string; eventNumber: string; title: string; type: string; status: string; description: string | null; category: string | null; currency: string; deadline: string | null; requiredDate: string | null; deliveryLocation: string | null; terms: string | null; questions: Question[] | null; evaluation: Evaluation | null; owner: { name: string }; items: Item[]; invites: Invite[]; awardedInviteId: string | null; awardReason: string | null; awardedContractId: string | null; awardedPoId: string | null };
type Proposal = { id: string; tool: string; input: Record<string, unknown>; rationale: string | null };
type BidLink = { inviteId: string; name: string; email: string; link: string; emailed: boolean; emailNote?: string };

const TABS = ["Request", "Suppliers", "Bids", "Activity"] as const;
const input = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white";
const btn = "text-xs px-3 py-1.5 rounded-lg disabled:opacity-50";
const primary = `${btn} bg-[#1A2A52] text-white hover:bg-[#14203f]`;
const ghost = `${btn} border border-gray-200 text-gray-600 hover:bg-gray-50`;
const toLocalInput = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const money = (n: number | string, cur: string) => `${cur} ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function SourcingEventPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const [ev, setEv] = useState<EventT | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Request");
  const [form, setForm] = useState<{ title: string; description: string; category: string; currency: string; deadline: string; requiredDate: string; deliveryLocation: string; terms: string; items: Item[]; questions: Question[] } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null); const [info, setInfo] = useState<string | null>(null);
  const [links, setLinks] = useState<BidLink[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [pick, setPick] = useState(""); const [ext, setExt] = useState({ name: "", email: "" });
  const [aiText, setAiText] = useState("");
  const autoSetup = useRef(false);

  const load = useCallback(async (keepForm = false) => {
    const res = await fetch(`/api/sourcing/${id}`);
    if (!res.ok) { setError((await res.json().catch(() => null))?.error ?? "Could not load this request"); return; }
    const d = await res.json(); const e: EventT = d.event;
    setEv(e); setScores(d.scores);
    fetch(`/api/agents/actions?eventId=${id}`).then(r => r.ok ? r.json() : { actions: [] }).then(a => setProposals(a.actions ?? [])).catch(() => {});
    if (!keepForm) {
      setForm({ title: e.title, description: e.description ?? "", category: e.category ?? "", currency: e.currency, deadline: toLocalInput(e.deadline), requiredDate: e.requiredDate?.slice(0, 10) ?? "", deliveryLocation: e.deliveryLocation ?? "", terms: e.terms ?? "",
        items: e.items.map(i => ({ ...i, quantity: Number(i.quantity), targetPrice: i.targetPrice != null ? Number(i.targetPrice) : null })), questions: e.questions ?? [] });
      setDirty(false);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch("/api/suppliers").then(r => r.json()).then(d => setSuppliers((d.suppliers ?? []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })))).catch(() => {}); }, []);

  async function call(key: string, url: string, method: string, body?: unknown, ok?: (d: any) => void) { // eslint-disable-line @typescript-eslint/no-explicit-any
    setBusy(key); setError(null); setInfo(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const d = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) { setError(d?.error ?? "That didn't work"); return false; }
    ok?.(d); await load(); return true;
  }

  const editable = ev?.status === "DRAFT";
  const set = (patch: Partial<NonNullable<typeof form>>) => { setForm(f => f && ({ ...f, ...patch })); setDirty(true); };

  const save = () => form && call("save", `/api/sourcing/${id}`, "PATCH", {
    title: form.title, description: form.description || null, category: form.category || null, currency: form.currency,
    deadline: form.deadline ? new Date(form.deadline).toISOString() : null, requiredDate: form.requiredDate || null, deliveryLocation: form.deliveryLocation || null, terms: form.terms || null,
    questions: form.questions.filter(q => q.text.trim().length >= 3),
    items: form.items.filter(i => i.description.trim().length >= 2 && Number(i.quantity) > 0).map(i => ({ description: i.description, quantity: Number(i.quantity), unit: i.unit || null, specification: i.specification || null, targetPrice: i.targetPrice === "" || i.targetPrice == null ? null : Number(i.targetPrice) })),
  }, () => setInfo("Saved."));

  const transition = (action: string, extra?: object) => call(action, `/api/sourcing/${id}/transition`, "POST", { action, ...extra }, d => { if (d.invites?.length) { setLinks(d.invites); setTab("Suppliers"); } if (d.warnings?.length) setInfo(`Awarded. Note: ${d.warnings.join(" ")}`); });

  async function runAgent(key: string, instruction?: string) {
    setBusy(`ai-${key}`); setError(null); setInfo(null);
    const res = await fetch(`/api/agents/${key}/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: { eventId: id, ...(instruction && { instruction }) } }) });
    const d = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) { setError(d?.error ?? "The assistant could not run"); return; }
    setInfo(d.run.status === "WAITING_HUMAN" ? "The assistant has finished — review its proposal below and approve it to apply it." : d.run.status === "FAILED" ? `The assistant failed: ${d.run.error}` : `Assistant: ${d.run.summary}`);
    await load();
  }
  async function decide(pid: string, decision: "approve" | "reject") {
    setBusy(`p-${pid}`); setError(null);
    const res = await fetch(`/api/agents/actions/${pid}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
    const d = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) setError(d?.error ?? "Could not record your decision"); else if (d.action?.status === "FAILED") setError(`It couldn't be applied: ${d.action.error}`); else setInfo(decision === "approve" ? "Applied." : "Proposal rejected.");
    await load();
  }
  const copy = (link: string, k: string) => { navigator.clipboard.writeText(link); setCopied(k); setTimeout(() => setCopied(null), 1500); };

  useEffect(() => {
    if (ev && search.get("setup") === "1" && !autoSetup.current && ev.status === "DRAFT" && ev.items.length === 0) { autoSetup.current = true; runAgent("rfq-assistant", "Set up this request from its description."); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev]);

  if (error && !ev) return <div className="p-8 text-sm text-red-600">{error}</div>;
  if (!ev || !form) return <div className="p-8 text-sm text-gray-400">Loading…</div>;

  const bidders = ev.invites.filter(i => i.bid);
  const lowest = bidders.length ? Math.min(...bidders.map(i => Number(i.bid!.totalAmount))) : 0;
  const scoreOf = (iid: string) => scores.find(s => s.inviteId === iid);
  const ranked = [...bidders].sort((a, b) => (scoreOf(a.id)?.rank ?? 99) - (scoreOf(b.id)?.rank ?? 99));
  const shown = proposals.slice(0, 3);
  const pendingSetup = proposals.some(p => p.tool === "propose_items");

  return (
    <div className="p-8 max-w-6xl space-y-5">
      <div>
        <Link href="/dashboard/sourcing" className="text-xs text-gray-400 hover:underline">← Sourcing</Link>
        <div className="flex items-start justify-between gap-4 mt-1">
          <div><h1 className="text-xl font-semibold text-gray-900">{ev.title}</h1>
            <p className="text-xs text-gray-400 mt-1">{ev.eventNumber} · {ev.type} · owner {ev.owner.name}{ev.deadline ? ` · bids due ${new Date(ev.deadline).toLocaleString()}` : ""}</p></div>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${SOURCING_STATUS_STYLE[ev.status]}`}>{ev.status.toLowerCase()}</span>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl">{error}</div>}
      {info && <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs px-4 py-3 rounded-xl">{info}</div>}

      <div className="flex flex-wrap gap-2">
        {ev.status === "DRAFT" && <button disabled={!!busy || dirty} title={dirty ? "Save your changes first" : undefined} onClick={() => transition("publish")} className={primary}>Publish &amp; invite suppliers</button>}
        {ev.status === "OPEN" && <button disabled={!!busy} onClick={() => confirm("Close bidding now? Suppliers will no longer be able to bid.") && transition("close")} className={primary}>Close bidding now</button>}
        {ev.status === "OPEN" && <button disabled={!!busy} onClick={() => { const v = prompt("New deadline (must be later). Format: YYYY-MM-DD HH:MM", ""); if (v) { const d = new Date(v.replace(" ", "T")); if (isNaN(d.getTime())) setError("That date didn't look right"); else call("extend", `/api/sourcing/${id}`, "PATCH", { deadline: d.toISOString() }, () => setInfo("Deadline extended.")); } }} className={ghost}>Extend deadline</button>}
        {["DRAFT", "OPEN", "EVALUATION"].includes(ev.status) && <button disabled={!!busy} onClick={() => confirm("Cancel this request?") && transition("cancel")} className={ghost}>Cancel</button>}
        {ev.status === "AWARDED" && !ev.awardedContractId && <button disabled={!!busy} onClick={() => call("contract", `/api/sourcing/${id}/create-contract`, "POST", undefined, d => { window.location.assign(`/dashboard/contracts/${d.contract.id}`); })} className={primary}>Create contract from award</button>}
        {ev.status === "AWARDED" && ev.awardedContractId && <Link href={`/dashboard/contracts/${ev.awardedContractId}`} className={ghost}>Open the contract</Link>}
        {ev.status === "AWARDED" && !ev.awardedPoId && <button disabled={!!busy} onClick={() => call("po", `/api/sourcing/${id}/create-po`, "POST", undefined, d => { window.location.assign(`/dashboard/purchase-orders/${d.purchaseOrder.id}`); })} className={ghost}>Create purchase order</button>}
        {ev.status === "AWARDED" && ev.awardedPoId && <Link href={`/dashboard/purchase-orders/${ev.awardedPoId}`} className={ghost}>Open the purchase order</Link>}
      </div>

      {ev.status === "AWARDED" && (() => { const w = ev.invites.find(i => i.id === ev.awardedInviteId); return w?.supplier && w.supplier.status !== "ACTIVE" ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs px-4 py-3 rounded-xl"><strong>{w.name}</strong> is a new vendor and hasn&apos;t completed supplier onboarding ({(w.supplier.onboardingStage ?? "registration").toLowerCase().replace(/_/g, " ")}). You can draft the contract, but it can&apos;t be signed and no purchase order can be placed until they&apos;re approved. <Link href={`/dashboard/suppliers/${w.supplier.id}`} className="underline">Open their onboarding</Link>.</div>) : null; })()}

      {links.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
          <p className="text-xs font-medium text-emerald-800">Bid links issued. Copy any that weren&apos;t emailed — they aren&apos;t shown again (you can re-issue one anytime).</p>
          {links.map(i => (
            <div key={i.inviteId} className="flex items-center gap-2 text-xs">
              <span className="w-40 truncate text-gray-700">{i.name}</span>
              <span className={i.emailed ? "text-emerald-700" : "text-amber-700"}>{i.emailed ? "emailed" : "not emailed"}</span>
              <input readOnly value={i.link} className="flex-1 min-w-0 text-[11px] border border-gray-200 rounded px-2 py-1 bg-white font-mono" />
              <button onClick={() => copy(i.link, i.inviteId)} className={ghost}>{copied === i.inviteId ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</button>
            </div>
          ))}
          {links.some(i => !i.emailed) && <p className="text-[11px] text-emerald-700">{links.find(i => !i.emailed)?.emailNote}</p>}
        </div>
      )}

      {shown.map(p => (
        <div key={p.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <p className="text-sm font-medium text-amber-900 flex items-center gap-1.5"><Sparkles className="size-4" />
            {p.tool === "propose_items" ? "The assistant proposes these items and questions" : p.tool === "propose_invites" ? "The assistant suggests inviting these suppliers" : "The assistant proposes an evaluation"}</p>
          {p.tool === "propose_items" && (
            <div className="text-xs text-gray-700 space-y-1">
              {(p.input.items as { description: string; quantity: number; unit?: string; specification?: string }[]).map((it, i) => <p key={i}>• {it.description} — {it.quantity}{it.unit ? ` ${it.unit}` : ""}{it.specification ? <span className="text-gray-400"> ({it.specification})</span> : null}</p>)}
              {Array.isArray(p.input.questions) && (p.input.questions as { text: string; required: boolean }[]).length > 0 && <p className="pt-1 text-gray-500">Questions: {(p.input.questions as { text: string }[]).map(q => q.text).join(" · ")}</p>}
            </div>
          )}
          {p.tool === "propose_invites" && <p className="text-xs text-gray-700">{(p.input.supplierIds as string[]).length} supplier(s). {String(p.input.rationale ?? "")}</p>}
          {p.tool === "save_evaluation" && <p className="text-xs text-gray-700 whitespace-pre-wrap">{String(p.input.summary ?? "")}</p>}
          <div className="flex gap-2">
            <button disabled={!!busy} onClick={() => decide(p.id, "approve")} className={primary}>{busy === `p-${p.id}` ? "Applying…" : "Approve & apply"}</button>
            <button disabled={!!busy} onClick={() => decide(p.id, "reject")} className={ghost}>Reject</button>
          </div>
        </div>
      ))}
      {proposals.length > shown.length && <p className="text-xs text-gray-400">{proposals.length - shown.length} more assistant proposal(s) waiting — see Agents.</p>}

      <div className="border-b border-gray-200 flex gap-5">
        {TABS.map(t => <button key={t} onClick={() => setTab(t)} className={`pb-2 text-sm ${tab === t ? "border-b-2 border-[#1A2A52] text-gray-900 font-medium" : "text-gray-400"}`}>{t}{t === "Bids" && bidders.length ? ` (${bidders.length})` : ""}</button>)}
      </div>

      {tab === "Request" && (
        <div className="space-y-4">
          {editable && (
            <div className="flex flex-wrap items-center gap-2">
              <input value={aiText} onChange={e => setAiText(e.target.value)} placeholder="Optional: guide the assistant (e.g. 'include 5% spares')" className={`${input} max-w-sm`} />
              <button disabled={!!busy || dirty || pendingSetup} title={dirty ? "Save your changes first" : pendingSetup ? "Approve or reject the pending proposal first" : undefined} onClick={() => runAgent("rfq-assistant", aiText || undefined)} className={primary}>
                {busy === "ai-rfq-assistant" ? <Loader2 className="size-3.5 animate-spin inline mr-1" /> : <Sparkles className="size-3.5 inline mr-1" />}{busy === "ai-rfq-assistant" ? "Working — this can take a minute…" : "Set up with AI"}</button>
            </div>
          )}
          <div className="grid md:grid-cols-3 gap-3">
            <label className="text-xs text-gray-500 md:col-span-2">Title<input disabled={!editable} value={form.title} onChange={e => set({ title: e.target.value })} className={input} /></label>
            <label className="text-xs text-gray-500">Category<input disabled={!editable} value={form.category} onChange={e => set({ category: e.target.value })} className={input} /></label>
            <label className="text-xs text-gray-500">Bids due by<input disabled={!editable} type="datetime-local" value={form.deadline} onChange={e => set({ deadline: e.target.value })} className={input} /></label>
            <label className="text-xs text-gray-500">Needed by<input disabled={!editable} type="date" value={form.requiredDate} onChange={e => set({ requiredDate: e.target.value })} className={input} /></label>
            <label className="text-xs text-gray-500">Deliver to<input disabled={!editable} value={form.deliveryLocation} onChange={e => set({ deliveryLocation: e.target.value })} className={input} /></label>
          </div>
          <label className="block text-xs text-gray-500">Brief for suppliers<textarea disabled={!editable} rows={4} value={form.description} onChange={e => set({ description: e.target.value })} className={input} /></label>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items to quote</p>
            <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] text-gray-400 border-b border-gray-100"><th className="px-3 py-2">Description</th><th className="px-3 py-2 w-24">Qty</th><th className="px-3 py-2 w-24">Unit</th><th className="px-3 py-2">Specification</th><th className="px-3 py-2 w-32" title="Internal only — never shown to suppliers">Target price (internal)</th><th className="w-8" /></tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {form.items.map((it, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1"><input disabled={!editable} value={it.description} onChange={e => set({ items: form.items.map((x, j) => j === i ? { ...x, description: e.target.value } : x) })} className={input} /></td>
                      <td className="px-2 py-1"><input disabled={!editable} type="number" min="0" value={it.quantity} onChange={e => set({ items: form.items.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x) })} className={input} /></td>
                      <td className="px-2 py-1"><input disabled={!editable} value={it.unit ?? ""} onChange={e => set({ items: form.items.map((x, j) => j === i ? { ...x, unit: e.target.value } : x) })} className={input} /></td>
                      <td className="px-2 py-1"><input disabled={!editable} value={it.specification ?? ""} onChange={e => set({ items: form.items.map((x, j) => j === i ? { ...x, specification: e.target.value } : x) })} className={input} /></td>
                      <td className="px-2 py-1"><input disabled={!editable} type="number" min="0" value={it.targetPrice ?? ""} onChange={e => set({ items: form.items.map((x, j) => j === i ? { ...x, targetPrice: e.target.value === "" ? null : Number(e.target.value) } : x) })} className={input} /></td>
                      <td>{editable && <button onClick={() => set({ items: form.items.filter((_, j) => j !== i) })} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="size-3.5" /></button>}</td>
                    </tr>
                  ))}
                  {form.items.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-400">No items yet.</td></tr>}
                </tbody>
              </table>
            </div>
            {editable && <button onClick={() => set({ items: [...form.items, { description: "", quantity: 1, unit: "", specification: "", targetPrice: null }] })} className={`${ghost} mt-2`}><Plus className="size-3.5 inline mr-1" />Add item</button>}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Questions for suppliers</p>
            {form.questions.map((q, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <input disabled={!editable} value={q.text} onChange={e => set({ questions: form.questions.map((x, j) => j === i ? { ...x, text: e.target.value } : x) })} className={input} placeholder="e.g. What warranty do you offer?" />
                <label className="text-xs text-gray-500 flex items-center gap-1 shrink-0"><input disabled={!editable} type="checkbox" checked={q.required} onChange={e => set({ questions: form.questions.map((x, j) => j === i ? { ...x, required: e.target.checked } : x) })} />required</label>
                {editable && <button onClick={() => set({ questions: form.questions.filter((_, j) => j !== i) })} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="size-3.5" /></button>}
              </div>
            ))}
            {editable && <button onClick={() => set({ questions: [...form.questions, { id: `q${form.questions.length + 1}-${Date.now() % 10000}`, text: "", required: false }] })} className={ghost}><Plus className="size-3.5 inline mr-1" />Add question</button>}
          </div>
          <label className="block text-xs text-gray-500">Terms &amp; conditions for this request (optional)<textarea disabled={!editable} rows={3} value={form.terms} onChange={e => set({ terms: e.target.value })} className={input} /></label>
          {editable && <div className="flex items-center gap-3"><button disabled={!dirty || !!busy} onClick={save} className={primary}>Save changes</button>{dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}</div>}
          {!editable && <p className="text-xs text-gray-400">This request is {ev.status.toLowerCase()}, so it can no longer be edited.</p>}
        </div>
      )}

      {tab === "Suppliers" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {ev.invites.length === 0 && <p className="p-6 text-center text-sm text-gray-400">No suppliers invited yet.</p>}
            {ev.invites.map(i => (
              <div key={i.id} className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="text-sm font-medium text-gray-900">{i.name}{i.supplier?.riskLevel && <span className="ml-2 text-[10px] text-gray-400">risk {i.supplier.riskLevel.toLowerCase()}</span>}{i.supplier && i.supplier.status !== "ACTIVE" && <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700" title="New vendor — must finish supplier onboarding before a contract can be signed or an order placed">new vendor · onboarding</span>}</p>
                  <p className="text-xs text-gray-400">{i.email}</p>
                  {i.declineReason && <p className="text-xs text-red-600 mt-1">Declined: {i.declineReason}</p>}</div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${i.status === "SUBMITTED" ? "bg-emerald-50 text-emerald-700" : i.status === "DECLINED" ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"}`}>{i.status === "SUBMITTED" ? "bid in" : i.status.toLowerCase()}</span>
                  {ev.status === "OPEN" && i.status !== "DECLINED" && <button disabled={!!busy} onClick={() => call(`s-${i.id}`, `/api/sourcing/${id}/invites/${i.id}/send`, "POST", undefined, d => setLinks([d.invite]))} className={ghost}>Re-issue link</button>}
                  {editable && <button onClick={() => call(`d-${i.id}`, `/api/sourcing/${id}/invites/${i.id}`, "DELETE")} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="size-3.5" /></button>}
                </div>
              </div>
            ))}
          </div>
          {["DRAFT", "OPEN"].includes(ev.status) && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex gap-2"><select value={pick} onChange={e => setPick(e.target.value)} className={input}><option value="">Add from your supplier list…</option>{suppliers.filter(s => !ev.invites.some(i => i.supplierId === s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <button disabled={!pick || !!busy} onClick={() => call("addsup", `/api/sourcing/${id}/invites`, "POST", { supplierId: pick }, () => setPick(""))} className={primary}>Add</button></div>
              <div className="flex gap-2 items-end"><label className="flex-1 text-xs text-gray-500">Or a new supplier — name<input value={ext.name} onChange={e => setExt({ ...ext, name: e.target.value })} className={input} /></label>
                <label className="flex-1 text-xs text-gray-500">Email<input type="email" value={ext.email} onChange={e => setExt({ ...ext, email: e.target.value })} className={input} /></label>
                <button disabled={!ext.name || !ext.email || !!busy} onClick={() => call("addext", `/api/sourcing/${id}/invites`, "POST", ext, d => { setExt({ name: "", email: "" }); if (d.newVendor) setInfo("Added — and registered as a new vendor in your supplier list. They can bid now, but must complete supplier onboarding before you can contract or order from them."); })} className={primary}>Add</button></div>
              <p className="text-[11px] text-gray-400">A vendor who isn&apos;t in your supplier list is registered automatically as a new supplier and goes through onboarding. They can bid, but nothing can be signed or ordered until they&apos;re approved.</p>
            </div>
          )}
        </div>
      )}

      {tab === "Bids" && (
        <div className="space-y-4">
          {bidders.length === 0 ? <p className="text-sm text-gray-400 bg-white border border-gray-200 rounded-xl p-8 text-center">{ev.status === "DRAFT" ? "Publish the request to start receiving bids." : "No bids yet."}</p> : (
            <>
              {["EVALUATION", "AWARDED"].includes(ev.status) && !ev.evaluation && ev.status === "EVALUATION" && (
                <button disabled={!!busy || proposals.some(p => p.tool === "save_evaluation")} onClick={() => runAgent("bid-evaluator")} className={primary}>
                  {busy === "ai-bid-evaluator" ? <Loader2 className="size-3.5 animate-spin inline mr-1" /> : <Sparkles className="size-3.5 inline mr-1" />}{busy === "ai-bid-evaluator" ? "Analysing bids…" : "Evaluate bids with AI"}</button>
              )}
              {ev.evaluation && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-1">
                  <p className="text-sm font-medium text-blue-900 flex items-center gap-1.5"><Sparkles className="size-4" />Assistant&apos;s evaluation — recommends {ev.invites.find(i => i.id === ev.evaluation!.recommendedInviteId)?.name ?? "a bidder"}</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{ev.evaluation.summary}</p>
                  <p className="text-[11px] text-blue-700">A recommendation only. The award is your decision.</p>
                </div>
              )}
              <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] text-gray-400 border-b border-gray-100">
                    <th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Target</th>
                    {ranked.map(i => <th key={i.id} className="px-3 py-2 text-right min-w-32">{i.name}{scoreOf(i.id)?.rank === 1 && <Trophy className="size-3 inline ml-1 text-amber-500" />}{ev.awardedInviteId === i.id && <span className="ml-1 text-emerald-600">awarded</span>}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {ev.items.map(it => {
                      const prices = ranked.map(b => Number(b.bid!.lines.find(l => l.itemId === it.id)?.unitPrice ?? 0)).filter(Boolean);
                      const min = prices.length ? Math.min(...prices) : 0;
                      return (
                        <tr key={it.id}>
                          <td className="px-3 py-2 text-gray-800">{it.description} <span className="text-xs text-gray-400">× {Number(it.quantity)}</span></td>
                          <td className="px-3 py-2 text-right text-gray-400">{it.targetPrice != null ? Number(it.targetPrice).toLocaleString() : "—"}</td>
                          {ranked.map(b => { const p = Number(b.bid!.lines.find(l => l.itemId === it.id)?.unitPrice ?? 0); return <td key={b.id} className={`px-3 py-2 text-right ${p && p === min ? "text-emerald-700 font-medium bg-emerald-50/50" : "text-gray-700"}`}>{p ? p.toLocaleString() : "—"}</td>; })}
                        </tr>
                      );
                    })}
                    <tr className="bg-gray-50/60 font-medium"><td className="px-3 py-2">Total</td><td />{ranked.map(b => <td key={b.id} className={`px-3 py-2 text-right ${Number(b.bid!.totalAmount) === lowest ? "text-emerald-700" : ""}`}>{money(b.bid!.totalAmount, ev.currency)}</td>)}</tr>
                    <tr><td className="px-3 py-2 text-gray-500">Lead time</td><td />{ranked.map(b => <td key={b.id} className="px-3 py-2 text-right text-gray-700">{b.bid!.leadTimeDays != null ? `${b.bid!.leadTimeDays} days` : "—"}</td>)}</tr>
                    <tr><td className="px-3 py-2 text-gray-500">Payment terms</td><td />{ranked.map(b => <td key={b.id} className="px-3 py-2 text-right text-gray-700">{b.bid!.paymentTerms ?? "—"}</td>)}</tr>
                    <tr><td className="px-3 py-2 text-gray-500">Bid valid for</td><td />{ranked.map(b => <td key={b.id} className="px-3 py-2 text-right text-gray-700">{b.bid!.validityDays ? `${b.bid!.validityDays} days` : "—"}</td>)}</tr>
                    <tr><td className="px-3 py-2 text-gray-500">Supplier risk</td><td />{ranked.map(b => <td key={b.id} className="px-3 py-2 text-right text-gray-700">{b.supplier?.riskLevel?.toLowerCase() ?? "unknown"}</td>)}</tr>
                    <tr className="bg-[#1A2A52]/5"><td className="px-3 py-2 font-medium">Score <span className="text-[10px] font-normal text-gray-400">(price 60 · lead time 20 · risk 20)</span></td><td />{ranked.map(b => <td key={b.id} className="px-3 py-2 text-right font-medium">{scoreOf(b.id)?.score.toFixed(1)} <span className="text-[10px] text-gray-400">#{scoreOf(b.id)?.rank}</span></td>)}</tr>
                    {ev.status === "EVALUATION" && <tr><td className="px-3 py-2" /><td />{ranked.map(b => <td key={b.id} className="px-3 py-2 text-right"><button disabled={!!busy} onClick={() => { const isLowest = Number(b.bid!.totalAmount) === lowest; let reason: string | undefined; if (!isLowest) { const r = prompt("This isn't the lowest bid. Why are you choosing it? (required for the audit trail)"); if (!r) return; reason = r; } if (confirm(`Award to ${b.name}?`)) transition("award", { inviteId: b.id, reason }); }} className={primary}>Award</button></td>)}</tr>}
                  </tbody>
                </table>
              </div>
              {ranked.some(b => b.bid!.notes || (ev.evaluation?.notes ?? []).some(n => n.inviteId === b.id) || Object.keys(b.bid!.answers ?? {}).length) && (
                <div className="grid md:grid-cols-2 gap-3">
                  {ranked.map(b => { const note = ev.evaluation?.notes.find(n => n.inviteId === b.id)?.note; const qs = ev.questions ?? [];
                    return (b.bid!.notes || note || Object.keys(b.bid!.answers ?? {}).length) ? (
                      <div key={b.id} className="bg-white border border-gray-200 rounded-xl p-3 text-xs space-y-1">
                        <p className="font-medium text-gray-900">{b.name}</p>
                        {note && <p className="text-blue-700">Assistant: {note}</p>}
                        {b.bid!.notes && <p className="text-gray-600">Notes: {b.bid!.notes}</p>}
                        {Object.entries(b.bid!.answers ?? {}).map(([qid, a]) => <p key={qid} className="text-gray-600"><span className="text-gray-400">{qs.find(q => q.id === qid)?.text ?? qid}:</span> {a}</p>)}
                      </div>) : null; })}
                </div>
              )}
              {ev.awardReason && <p className="text-xs text-gray-500">Award rationale: {ev.awardReason}</p>}
            </>
          )}
        </div>
      )}

      {tab === "Activity" && <ActivityLog entity="SOURCING" entityId={ev.id} title="Activity" />}
    </div>
  );
}
