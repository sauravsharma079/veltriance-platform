"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const input = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white";

export default function NewSourcingPage() {
  const router = useRouter();
  const [f, setF] = useState({ title: "", type: "RFQ", category: "", description: "", currency: "INR", deadline: "", requiredDate: "", deliveryLocation: "" });
  const [ai, setAi] = useState(true);
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null);
    const res = await fetch("/api/sourcing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      title: f.title, type: f.type, category: f.category || null, description: f.description || null, currency: f.currency || "INR",
      deadline: f.deadline ? new Date(f.deadline).toISOString() : null, requiredDate: f.requiredDate || null, deliveryLocation: f.deliveryLocation || null,
    }) });
    const d = await res.json().catch(() => null);
    if (!res.ok) { setError(d?.error ?? "Could not create the request"); setSaving(false); return; }
    router.push(`/dashboard/sourcing/${d.event.id}${ai ? "?setup=1" : ""}`);
  }
  return (
    <form onSubmit={submit} className="p-8 max-w-2xl space-y-5">
      <div><h1 className="text-xl font-semibold text-gray-900">New sourcing request</h1><p className="text-sm text-gray-500 mt-1">Describe what you need. You&apos;ll add the items, pick suppliers and publish next.</p></div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl">{error}</div>}
      <label className="block"><span className="text-xs text-gray-500">Title</span><input required minLength={3} value={f.title} onChange={e => set("title", e.target.value)} className={input} placeholder="e.g. 200 laptops for the Bengaluru office" /></label>
      <div className="grid grid-cols-3 gap-4">
        <label className="block"><span className="text-xs text-gray-500">Type</span><select value={f.type} onChange={e => set("type", e.target.value)} className={input}><option value="RFQ">RFQ — prices for defined items</option><option value="RFP">RFP — proposals</option><option value="RFI">RFI — information</option></select></label>
        <label className="block"><span className="text-xs text-gray-500">Category</span><input value={f.category} onChange={e => set("category", e.target.value)} className={input} placeholder="IT Hardware" /></label>
        <label className="block"><span className="text-xs text-gray-500">Currency</span><input maxLength={3} value={f.currency} onChange={e => set("currency", e.target.value.toUpperCase())} className={input} /></label>
      </div>
      <label className="block"><span className="text-xs text-gray-500">What do you need?</span><textarea rows={5} value={f.description} onChange={e => set("description", e.target.value)} className={input} placeholder="Describe the goods or services, quantities, quality expectations and anything suppliers should know. The more detail, the better the assistant can set up the request." /></label>
      <div className="grid grid-cols-3 gap-4">
        <label className="block"><span className="text-xs text-gray-500">Bids due by</span><input type="datetime-local" value={f.deadline} onChange={e => set("deadline", e.target.value)} className={input} /></label>
        <label className="block"><span className="text-xs text-gray-500">Needed by</span><input type="date" value={f.requiredDate} onChange={e => set("requiredDate", e.target.value)} className={input} /></label>
        <label className="block"><span className="text-xs text-gray-500">Deliver to</span><input value={f.deliveryLocation} onChange={e => set("deliveryLocation", e.target.value)} className={input} /></label>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={ai} onChange={e => setAi(e.target.checked)} />Have the assistant draft the items and shortlist suppliers from my description</label>
      <button disabled={saving} className="text-sm px-4 py-2 rounded-lg bg-[#1A2A52] text-white hover:bg-[#14203f] disabled:opacity-50">{saving ? "Creating…" : "Create request"}</button>
    </form>
  );
}
