"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BookOpen, Plus, Trash2 } from "lucide-react";

type Clause = { id: string; title: string; category: string; body: string; fallbackBody: string | null; guidance: string | null; required: boolean; active: boolean };
const input = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white";
const EMPTY = { title: "", category: "", body: "", fallbackBody: "", guidance: "", required: false };

export default function ClausesPage() {
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [f, setF] = useState(EMPTY);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/contract-clauses");
    if (!res.ok) { setBlocked((await res.json().catch(() => null))?.error ?? "Not available"); return; }
    setClauses((await res.json()).clauses);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const res = await fetch("/api/contract-clauses", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, fallbackBody: f.fallbackBody || null, guidance: f.guidance || null }) });
    if (!res.ok) { setError((await res.json().catch(() => null))?.error ?? "Could not save"); return; }
    setF(EMPTY); setAdding(false); load();
  }
  async function toggle(c: Clause, patch: Partial<Clause>) { await fetch(`/api/contract-clauses/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }); load(); }
  async function remove(c: Clause) { if (!confirm(`Delete "${c.title}"?`)) return; await fetch(`/api/contract-clauses/${c.id}`, { method: "DELETE" }); load(); }

  if (blocked) return <div className="p-8 text-sm text-gray-500">{blocked}</div>;
  return (
    <div className="p-8 max-w-4xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard/contracts" className="text-xs text-gray-400 hover:underline">← Contracts</Link>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mt-1"><BookOpen className="size-5" />Clause library</h1>
          <p className="text-sm text-gray-500 mt-1">Your standard wording and negotiation limits. The assistant drafts from this and checks every counter-proposal against it.</p>
        </div>
        <button onClick={() => setAdding(a => !a)} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-[#1A2A52] text-white"><Plus className="size-3.5" />Add clause</button>
      </div>

      {adding && (
        <form onSubmit={add} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="grid grid-cols-3 gap-3">
            <label className="col-span-2 block"><span className="text-xs text-gray-500">Title</span><input required value={f.title} onChange={e => setF({ ...f, title: e.target.value })} className={input} placeholder="Limitation of liability" /></label>
            <label className="block"><span className="text-xs text-gray-500">Category</span><input required value={f.category} onChange={e => setF({ ...f, category: e.target.value })} className={input} placeholder="Liability" /></label>
          </div>
          <label className="block"><span className="text-xs text-gray-500">Standard wording</span><textarea required rows={4} value={f.body} onChange={e => setF({ ...f, body: e.target.value })} className={input} /></label>
          <label className="block"><span className="text-xs text-gray-500">Approved fallback wording (optional)</span><textarea rows={3} value={f.fallbackBody} onChange={e => setF({ ...f, fallbackBody: e.target.value })} className={input} /></label>
          <label className="block"><span className="text-xs text-gray-500">Guidance: when may we concede? (optional)</span><textarea rows={2} value={f.guidance} onChange={e => setF({ ...f, guidance: e.target.value })} className={input} placeholder="e.g. Accept a cap of 12 months' fees for contracts under ₹10L; never accept uncapped liability." /></label>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={f.required} onChange={e => setF({ ...f, required: e.target.checked })} />Required in every contract</label>
          <button className="text-sm px-4 py-2 rounded-lg bg-[#1A2A52] text-white">Save clause</button>
        </form>
      )}

      {clauses.length === 0 ? <p className="text-sm text-gray-400 bg-white border border-gray-200 rounded-xl p-8 text-center">No clauses yet. Add your standard payment, liability, termination and confidentiality wording.</p> : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {clauses.map(c => (
            <div key={c.id} className={`p-4 ${c.active ? "" : "opacity-50"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{c.title} <span className="text-xs text-gray-400 font-normal">· {c.category}</span>{c.required && <span className="ml-2 text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded">required</span>}</p>
                  <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{c.body}</p>
                  {c.fallbackBody && <p className="text-xs text-gray-500 mt-2 whitespace-pre-wrap"><span className="font-medium">Fallback:</span> {c.fallbackBody}</p>}
                  {c.guidance && <p className="text-xs text-gray-400 mt-2 italic">{c.guidance}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => toggle(c, { active: !c.active })} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600">{c.active ? "Disable" : "Enable"}</button>
                  <button onClick={() => remove(c)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="size-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
