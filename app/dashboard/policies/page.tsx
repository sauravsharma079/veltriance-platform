"use client";
import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Trash2 } from "lucide-react";

type Rule = { id: string; type: string; name: string; params: Record<string, unknown>; active: boolean };
type RType = { type: string; label: string; describe: string };
const input = "text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white w-full";
const list = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);

export default function PoliciesPage() {
  const [rules, setRules] = useState<Rule[]>([]); const [types, setTypes] = useState<RType[]>([]); const [canEdit, setCanEdit] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [type, setType] = useState("AUTO_APPROVE"); const [name, setName] = useState(""); const [amount, setAmount] = useState(""); const [cats, setCats] = useState(""); const [step, setStep] = useState("PROCUREMENT"); const [days, setDays] = useState("30");
  const [err, setErr] = useState<string | null>(null);
  const [sim, setSim] = useState({ amount: "", category: "" }); const [simOut, setSimOut] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/policies");
    if (!r.ok) { setBlocked((await r.json().catch(() => null))?.error ?? "Policies aren't available for your account."); return; }
    const d = await r.json(); setRules(d.rules); setTypes(d.types); setCanEdit(d.canEdit);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add() {
    setErr(null); const n = Number(amount);
    const params = type === "AUTO_APPROVE" ? { maxAmount: n, categories: list(cats) }
      : type === "REQUIRE_SOURCING" ? { minAmount: n, categories: list(cats) }
      : type === "SPLIT_ORDER" ? { thresholdAmount: n, windowDays: Number(days) }
      : { categories: list(cats), stepType: step };
    const r = await fetch("/api/policies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, name: name || types.find(t => t.type === type)?.label, params }) });
    if (!r.ok) { setErr((await r.json().catch(() => null))?.error ?? "Couldn't save"); return; }
    setName(""); setAmount(""); setCats(""); load();
  }
  async function toggle(x: Rule) { await fetch(`/api/policies/${x.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !x.active }) }); load(); }
  async function remove(id: string) { if (confirm("Delete this rule?")) { await fetch(`/api/policies/${id}`, { method: "DELETE" }); load(); } }
  async function simulate() {
    const r = await fetch("/api/policies/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: Number(sim.amount), category: sim.category || null }) });
    setSimOut(r.ok ? await r.json() : { error: (await r.json().catch(() => null))?.error ?? "Failed" });
  }

  if (blocked) return <div className="p-8 text-sm text-gray-500">{blocked}</div>;
  const needsAmount = type !== "CATEGORY_STEP"; const needsCats = type !== "SPLIT_ORDER";
  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-1"><ShieldCheck size={20} /> Policies</h1>
      <p className="text-sm text-gray-500 mb-6">Rules that decide how a request travels the moment it&apos;s submitted — on top of your approval matrix and budgets. Same request, same answer, always with a reason.</p>

      {canEdit && (
        <div className="bg-white border border-gray-300 rounded-xl p-5 mb-6 space-y-3">
          <select className={input} value={type} onChange={e => setType(e.target.value)}>{types.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}</select>
          <p className="text-xs text-gray-500">{types.find(t => t.type === type)?.describe}</p>
          <input className={input} placeholder="Rule name (optional)" value={name} onChange={e => setName(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            {needsAmount && <input className={input} placeholder="Amount" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />}
            {type === "SPLIT_ORDER" && <input className={input} placeholder="Window in days" value={days} onChange={e => setDays(e.target.value)} />}
            {needsCats && <input className={input} placeholder="Categories, comma separated (blank = all)" value={cats} onChange={e => setCats(e.target.value)} />}
            {type === "CATEGORY_STEP" && <select className={input} value={step} onChange={e => setStep(e.target.value)}><option value="PROCUREMENT">Procurement</option><option value="FINANCE">Finance</option><option value="DIRECTOR">Director</option></select>}
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button onClick={add} className="text-sm px-4 py-2 rounded-lg bg-gray-900 text-white">Add rule</button>
        </div>
      )}

      {rules.length === 0 ? <p className="text-sm text-gray-400 mb-6">No policy rules yet.</p> : (
        <div className="bg-white border border-gray-300 rounded-xl divide-y divide-gray-100 mb-6">{rules.map(x => (
          <div key={x.id} className={`px-4 py-3 flex items-center justify-between ${x.active ? "" : "opacity-50"}`}>
            <div><p className="text-sm font-medium text-gray-900">{x.name}</p><p className="text-xs text-gray-400">{types.find(t => t.type === x.type)?.label} · {JSON.stringify(x.params)}</p></div>
            {canEdit && <div className="flex gap-3 text-xs text-gray-500"><button onClick={() => toggle(x)}>{x.active ? "Pause" : "Resume"}</button><button onClick={() => remove(x.id)} aria-label="Delete"><Trash2 size={14} /></button></div>}
          </div>))}</div>
      )}

      <div className="bg-white border border-gray-300 rounded-xl p-5">
        <p className="text-sm font-medium text-gray-900 mb-2">Try it</p>
        <div className="flex gap-3"><input className={input} placeholder="Request amount" inputMode="decimal" value={sim.amount} onChange={e => setSim({ ...sim, amount: e.target.value })} /><input className={input} placeholder="Category" value={sim.category} onChange={e => setSim({ ...sim, category: e.target.value })} /><button onClick={simulate} className="text-sm px-4 py-2 rounded-lg border border-gray-300 shrink-0">Simulate</button></div>
        {simOut && <pre className="mt-3 text-xs bg-gray-50 rounded-lg p-3 overflow-x-auto">{JSON.stringify(simOut, null, 2)}</pre>}
      </div>
    </div>
  );
}
