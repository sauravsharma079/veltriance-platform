"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CONTRACT_TYPE_OPTIONS } from "@/lib/contract-ui";

type Supplier = { id: string; name: string };
const input = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white";

export default function NewContractPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [f, setF] = useState({ title: "", type: "MSA", supplierId: "", description: "", value: "", currency: "INR", startDate: "", endDate: "", autoRenew: false, noticeDays: "60" });
  const [draftWithAi, setDraftWithAi] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetch("/api/suppliers").then(r => r.json()).then(d => setSuppliers(d.suppliers ?? [])).catch(() => {}); }, []);
  const set = (k: string, v: string | boolean) => setF(p => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null);
    const res = await fetch("/api/contracts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: f.title, type: f.type, supplierId: f.supplierId || null, description: f.description || null,
        value: f.value ? Number(f.value) : null, currency: f.currency || "INR",
        startDate: f.startDate || null, endDate: f.endDate || null, autoRenew: f.autoRenew, noticeDays: Number(f.noticeDays) || 60,
      }),
    });
    const d = await res.json().catch(() => null);
    if (!res.ok) { setError(d?.error ?? "Could not create the contract"); setSaving(false); return; }
    // ?draft=1 tells the contract page to start the drafting agent as soon as it opens.
    router.push(`/dashboard/contracts/${d.contract.id}${draftWithAi ? "?draft=1" : ""}`);
  }

  return (
    <form onSubmit={submit} className="p-8 max-w-2xl space-y-5">
      <div><h1 className="text-xl font-semibold text-gray-900">New contract</h1><p className="text-sm text-gray-500 mt-1">Start with the basics — you&apos;ll write or generate the text next.</p></div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl">{error}</div>}
      <label className="block"><span className="text-xs text-gray-500">Title</span><input required minLength={3} value={f.title} onChange={e => set("title", e.target.value)} className={input} placeholder="e.g. Master Services Agreement — Acme Logistics" /></label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block"><span className="text-xs text-gray-500">Type</span>
          <select value={f.type} onChange={e => set("type", e.target.value)} className={input}>{CONTRACT_TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="block"><span className="text-xs text-gray-500">Supplier</span>
          <select value={f.supplierId} onChange={e => set("supplierId", e.target.value)} className={input}><option value="">— none yet —</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      </div>
      <label className="block"><span className="text-xs text-gray-500">What is this for?</span><textarea rows={3} value={f.description} onChange={e => set("description", e.target.value)} className={input} placeholder="Scope, purpose and anything the drafting assistant should know" /></label>
      <div className="grid grid-cols-3 gap-4">
        <label className="block col-span-2"><span className="text-xs text-gray-500">Contract value</span><input type="number" min="0" step="0.01" value={f.value} onChange={e => set("value", e.target.value)} className={input} /></label>
        <label className="block"><span className="text-xs text-gray-500">Currency</span><input maxLength={3} value={f.currency} onChange={e => set("currency", e.target.value.toUpperCase())} className={input} /></label>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <label className="block"><span className="text-xs text-gray-500">Start date</span><input type="date" value={f.startDate} onChange={e => set("startDate", e.target.value)} className={input} /></label>
        <label className="block"><span className="text-xs text-gray-500">End date</span><input type="date" value={f.endDate} onChange={e => set("endDate", e.target.value)} className={input} /></label>
        <label className="block"><span className="text-xs text-gray-500">Notice period (days)</span><input type="number" min="0" max="365" value={f.noticeDays} onChange={e => set("noticeDays", e.target.value)} className={input} /></label>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={f.autoRenew} onChange={e => set("autoRenew", e.target.checked)} />Renews automatically unless cancelled</label>
      <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={draftWithAi} onChange={e => setDraftWithAi(e.target.checked)} />Have the assistant write a first draft from my clause library</label>
      <button disabled={saving} className="text-sm px-4 py-2 rounded-lg bg-[#1A2A52] text-white hover:bg-[#14203f] disabled:opacity-50">{saving ? "Creating…" : "Create contract"}</button>
    </form>
  );
}
