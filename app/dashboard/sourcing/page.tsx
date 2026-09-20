"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Gavel, Plus, Search } from "lucide-react";
import { SOURCING_STATUS_STYLE } from "@/lib/contract-ui";

type Row = { id: string; eventNumber: string; title: string; type: string; status: string; category: string | null; deadline: string | null; owner: { name: string }; bids: number; _count: { items: number; invites: number } };
const FILTERS = ["", "DRAFT", "OPEN", "EVALUATION", "AWARDED", "CANCELLED"];

export default function SourcingPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState(""); const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true); const [blocked, setBlocked] = useState<string | null>(null);

  const load = useCallback(async () => {
    const p = new URLSearchParams(); if (q) p.set("q", q); if (status) p.set("status", status);
    const res = await fetch(`/api/sourcing?${p}`);
    if (!res.ok) { setBlocked((await res.json().catch(() => null))?.error ?? "Sourcing isn't available for your account."); setLoading(false); return; }
    setRows((await res.json()).events); setLoading(false);
  }, [q, status]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  if (blocked) return <div className="p-8 max-w-xl"><h1 className="text-xl font-semibold text-gray-900">Sourcing</h1><p className="text-sm text-gray-500 mt-2">{blocked}</p></div>;
  return (
    <div className="p-8 max-w-6xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2"><Gavel className="size-5" /> Sourcing</h1>
          <p className="text-sm text-gray-500 mt-1">Ask suppliers to quote, compare their bids fairly, and award — then turn the winner into a contract or purchase order.</p>
        </div>
        <Link href="/dashboard/sourcing/new" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-[#1A2A52] text-white hover:bg-[#14203f]"><Plus className="size-3.5" />New request</Link>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative"><Search className="size-3.5 absolute left-3 top-2.5 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search title, number, category…" className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg w-72 bg-white" /></div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
          {FILTERS.map(f => <option key={f} value={f}>{f ? f.toLowerCase() : "All statuses"}</option>)}
        </select>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {loading ? <p className="p-8 text-sm text-gray-400">Loading…</p> : rows.length === 0 ? <p className="p-10 text-center text-sm text-gray-400">No sourcing requests yet.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
              <th className="px-4 py-3">Request</th><th className="px-4 py-3">Category</th><th className="px-4 py-3 text-center">Suppliers</th><th className="px-4 py-3 text-center">Bids</th><th className="px-4 py-3">Deadline</th><th className="px-4 py-3">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3"><Link href={`/dashboard/sourcing/${r.id}`} className="font-medium text-gray-900 hover:underline">{r.title}</Link><p className="text-xs text-gray-400">{r.eventNumber} · {r.type} · {r.owner.name}</p></td>
                  <td className="px-4 py-3 text-gray-600">{r.category ?? "—"}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{r._count.invites}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{r.bids}</td>
                  <td className="px-4 py-3 text-gray-600">{r.deadline ? new Date(r.deadline).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SOURCING_STATUS_STYLE[r.status]}`}>{r.status.toLowerCase()}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
