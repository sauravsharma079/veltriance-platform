"use client";
import { useCallback, useEffect, useState } from "react";
import { Wallet, Plus, Trash2 } from "lucide-react";

type Budget = { id: string; name: string; startDate: string; endDate: string; amount: number | string; currency: string; department: string | null; costCenter: string | null; category: string | null; warnPct: number; hardStop: boolean; active: boolean; committed: number; remaining: number; pct: number };
const input = "text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white w-full";
const money = (n: number, c: string) => `${c} ${Math.round(n).toLocaleString()}`;
const blank = { name: "", startDate: "", endDate: "", amount: "", currency: "INR", department: "", costCenter: "", category: "", warnPct: "80", hardStop: false };

export default function BudgetsPage() {
  const [rows, setRows] = useState<Budget[]>([]); const [canEdit, setCanEdit] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null); const [f, setF] = useState(blank); const [err, setErr] = useState<string | null>(null); const [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch("/api/budgets");
    if (!r.ok) { setBlocked((await r.json().catch(() => null))?.error ?? "Budgets aren't available for your account."); return; }
    const d = await r.json(); setRows(d.budgets); setCanEdit(d.canEdit);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create() {
    setErr(null);
    const r = await fetch("/api/budgets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, amount: Number(f.amount), warnPct: Number(f.warnPct), department: f.department || null, costCenter: f.costCenter || null, category: f.category || null, active: true }) });
    if (!r.ok) { setErr((await r.json().catch(() => null))?.error ?? "Couldn't save"); return; }
    setF(blank); setOpen(false); load();
  }
  async function remove(id: string) { if (confirm("Delete this budget?")) { await fetch(`/api/budgets/${id}`, { method: "DELETE" }); load(); } }
  async function toggle(b: Budget) { await fetch(`/api/budgets/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !b.active }) }); load(); }

  if (blocked) return <div className="p-8 text-sm text-gray-500">{blocked}</div>;
  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2"><Wallet size={20} /> Budgets</h1>
        {canEdit && <button onClick={() => setOpen(o => !o)} className="text-sm px-3 py-2 rounded-lg bg-gray-900 text-white flex items-center gap-1"><Plus size={14} /> New budget</button>}
      </div>
      <p className="text-sm text-gray-500 mb-6">Every new request is checked against matching budgets. Committed spend counts requests in approval plus open purchase orders. Set a department, cost centre or category to narrow a budget; leave them blank to cover everything.</p>
      {open && (
        <div className="bg-white border border-gray-300 rounded-xl p-5 mb-6 grid grid-cols-2 gap-3">
          <input className={input} placeholder="Name (e.g. Engineering FY27)" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
          <div className="flex gap-2"><input className={input} placeholder="Amount" inputMode="decimal" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /><input className={`${input} !w-24`} value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })} /></div>
          <label className="text-xs text-gray-500">Starts<input type="date" className={input} value={f.startDate} onChange={e => setF({ ...f, startDate: e.target.value })} /></label>
          <label className="text-xs text-gray-500">Ends<input type="date" className={input} value={f.endDate} onChange={e => setF({ ...f, endDate: e.target.value })} /></label>
          <input className={input} placeholder="Department (optional)" value={f.department} onChange={e => setF({ ...f, department: e.target.value })} />
          <input className={input} placeholder="Cost centre (optional)" value={f.costCenter} onChange={e => setF({ ...f, costCenter: e.target.value })} />
          <input className={input} placeholder="Category (optional)" value={f.category} onChange={e => setF({ ...f, category: e.target.value })} />
          <label className="text-xs text-gray-500 flex items-center gap-2">Warn at %<input className={`${input} !w-20`} value={f.warnPct} onChange={e => setF({ ...f, warnPct: e.target.value })} /></label>
          <label className="col-span-2 text-sm text-gray-700 flex items-center gap-2"><input type="checkbox" checked={f.hardStop} onChange={e => setF({ ...f, hardStop: e.target.checked })} /> Hard stop — block requests that would exceed this budget (otherwise they go to Finance for approval)</label>
          {err && <p className="col-span-2 text-sm text-red-600">{err}</p>}
          <div className="col-span-2"><button onClick={create} className="text-sm px-4 py-2 rounded-lg bg-emerald-700 text-white">Save budget</button></div>
        </div>
      )}
      {rows.length === 0 ? <p className="text-sm text-gray-400">No budgets yet — requests are not checked against any spend limit.</p> : (
        <div className="space-y-3">{rows.map(b => {
          const pct = Math.min(100, b.pct); const bar = b.pct >= 100 ? "bg-red-500" : b.pct >= b.warnPct ? "bg-amber-500" : "bg-emerald-600";
          return (
            <div key={b.id} className={`bg-white border border-gray-300 rounded-xl p-4 ${b.active ? "" : "opacity-50"}`}>
              <div className="flex justify-between items-start">
                <div><p className="font-medium text-gray-900">{b.name}{b.hardStop && <span className="ml-2 text-[10px] uppercase bg-red-50 text-red-700 px-1.5 py-0.5 rounded">hard stop</span>}</p>
                  <p className="text-xs text-gray-400">{new Date(b.startDate).toLocaleDateString()} – {new Date(b.endDate).toLocaleDateString()} · {[b.department, b.costCenter, b.category].filter(Boolean).join(" / ") || "Whole organisation"}</p></div>
                {canEdit && <div className="flex gap-3 text-xs text-gray-500"><button onClick={() => toggle(b)}>{b.active ? "Pause" : "Resume"}</button><button onClick={() => remove(b.id)} aria-label="Delete"><Trash2 size={14} /></button></div>}
              </div>
              <div className="h-2 bg-gray-100 rounded-full mt-3 overflow-hidden"><div className={`h-full ${bar}`} style={{ width: `${pct}%` }} /></div>
              <p className="text-xs text-gray-500 mt-1.5">{money(b.committed, b.currency)} committed of {money(Number(b.amount), b.currency)} · {money(b.remaining, b.currency)} left</p>
            </div>);
        })}</div>
      )}
    </div>
  );
}
