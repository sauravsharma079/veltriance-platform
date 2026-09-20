"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FileSignature, Plus, Search, BookOpen, AlertTriangle } from "lucide-react";
import { STATUS_STYLE } from "@/lib/contract-ui";

type Row = { id: string; contractNumber: string; title: string; type: string; status: string; value: string | null; currency: string; endDate: string | null; noticeDays: number; autoRenew: boolean; supplier: { name: string } | null; owner: { name: string } };

const FILTERS = ["", "DRAFT", "NEGOTIATION", "PENDING_APPROVAL", "PENDING_SIGNATURE", "ACTIVE", "EXPIRED", "TERMINATED"];
const daysTo = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);

export default function ContractsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<string | null>(null);

  const load = useCallback(async () => {
    const p = new URLSearchParams(); if (q) p.set("q", q); if (status) p.set("status", status);
    const res = await fetch(`/api/contracts?${p}`);
    if (!res.ok) { setBlocked((await res.json().catch(() => null))?.error ?? "Contracts aren't available for your account."); setLoading(false); return; }
    setRows((await res.json()).contracts); setLoading(false);
  }, [q, status]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  if (blocked) return <div className="p-8 max-w-xl"><h1 className="text-xl font-semibold text-gray-900">Contracts</h1><p className="text-sm text-gray-500 mt-2">{blocked}</p></div>;

  const ending = rows.filter(r => r.status === "ACTIVE" && r.endDate && daysTo(r.endDate) <= r.noticeDays + 30);
  return (
    <div className="p-8 max-w-6xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2"><FileSignature className="size-5" /> Contracts</h1>
          <p className="text-sm text-gray-500 mt-1">Draft, negotiate, sign and keep every agreement in one place.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/contracts/clauses" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"><BookOpen className="size-3.5" />Clause library</Link>
          <Link href="/dashboard/contracts/new" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-[#1A2A52] text-white hover:bg-[#14203f]"><Plus className="size-3.5" />New contract</Link>
        </div>
      </div>

      {ending.length > 0 && (
        <div className="flex gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-3 rounded-xl">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{ending.length} active contract{ending.length > 1 ? "s are" : " is"} approaching the renewal or notice deadline: {ending.slice(0, 3).map(e => e.title).join(", ")}{ending.length > 3 ? "…" : ""}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative"><Search className="size-3.5 absolute left-3 top-2.5 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search title, number, supplier…" className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg w-72 bg-white" /></div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
          {FILTERS.map(f => <option key={f} value={f}>{f ? f.replace("_", " ").toLowerCase() : "All statuses"}</option>)}
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {loading ? <p className="p-8 text-sm text-gray-400">Loading…</p> : rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-400">No contracts yet. Create your first one.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
              <th className="px-4 py-3">Contract</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-right">Value</th><th className="px-4 py-3">Ends</th><th className="px-4 py-3">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3"><Link href={`/dashboard/contracts/${r.id}`} className="font-medium text-gray-900 hover:underline">{r.title}</Link><p className="text-xs text-gray-400">{r.contractNumber} · {r.owner.name}</p></td>
                  <td className="px-4 py-3 text-gray-600">{r.supplier?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{r.type.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{r.value ? `${r.currency} ${Number(r.value).toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{r.endDate ? new Date(r.endDate).toLocaleDateString() : "—"}{r.autoRenew && <span className="ml-1 text-[10px] text-gray-400">auto-renews</span>}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>{r.status.replace("_", " ")}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
