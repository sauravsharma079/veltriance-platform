"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function IntakeFormPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    quantity: "1",
    unitPrice: "",
    supplierName: "",
    deliveryLocation: "",
    costCenter: "",
    requiredDate: "",
    currency: "USD",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/intake/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, intakeSource: "FORM" }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Please check the form for missing or invalid fields.");
      return;
    }
    const { requisition } = await res.json();
    router.push(`/dashboard/requisitions/${requisition.id}`);
  }

  return (
    <div className="p-8 max-w-2xl">
      <Link href="/dashboard/intake" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft className="size-3.5" /> Back
      </Link>

      <h1 className="text-xl font-semibold text-gray-900">Submit a request</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">Fill in as much detail as you have — this becomes your requisition draft.</p>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-gray-200 rounded-xl p-6">
        <Field label="Request title">
          <input required value={form.title} onChange={(e) => update("title", e.target.value)} className="input" placeholder="20x Laptops for new hires" />
        </Field>

        <Field label="Description">
          <textarea rows={3} value={form.description} onChange={(e) => update("description", e.target.value)} className="input resize-none" placeholder="Any additional detail…" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <input required value={form.category} onChange={(e) => update("category", e.target.value)} className="input" placeholder="IT Hardware" />
          </Field>
          <Field label="Supplier (optional)">
            <input value={form.supplierName} onChange={(e) => update("supplierName", e.target.value)} className="input" placeholder="Leave blank if unsure" />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Quantity">
            <input required type="number" min="1" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} className="input" />
          </Field>
          <Field label="Unit price (est.)">
            <input required type="number" min="0" step="0.01" value={form.unitPrice} onChange={(e) => update("unitPrice", e.target.value)} className="input" />
          </Field>
          <Field label="Currency">
            <select value={form.currency} onChange={(e) => update("currency", e.target.value)} className="input">
              {["USD", "EUR", "GBP", "INR", "AUD", "CAD", "SGD", "AED"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Delivery location">
            <input value={form.deliveryLocation} onChange={(e) => update("deliveryLocation", e.target.value)} className="input" placeholder="Noida office" />
          </Field>
          <Field label="Cost center">
            <input value={form.costCenter} onChange={(e) => update("costCenter", e.target.value)} className="input" placeholder="Defaults to your profile" />
          </Field>
        </div>

        <Field label="Required by">
          <input type="date" value={form.requiredDate} onChange={(e) => update("requiredDate", e.target.value)} className="input" />
        </Field>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-[#1A2A52] text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-[#243766] transition-colors disabled:opacity-50"
        >
          {loading ? "Submitting…" : "Submit request"}
        </button>
      </form>
      <style jsx global>{`
        .input { width: 100%; border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.625rem 0.875rem; font-size: 0.875rem; outline: none; }
        .input:focus { border-color: #1a2a52; box-shadow: 0 0 0 1px #1a2a52; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
