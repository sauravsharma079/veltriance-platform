"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewSupplierPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", contactEmail: "", category: "", businessJustification: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Please check the form — all fields are required, and the justification needs at least 10 characters.");
      return;
    }
    router.push("/dashboard/suppliers");
    router.refresh();
  }

  return (
    <div className="p-8 max-w-xl">
      <Link href="/dashboard/suppliers" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft className="size-3.5" /> Back to suppliers
      </Link>

      <h1 className="text-xl font-semibold text-gray-900">Request a new supplier</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        This supplier doesn&apos;t exist in our master yet. Submitting this starts an approval workflow before they become available for requisitions.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-gray-200 rounded-xl p-6">
        <Field label="Supplier name">
          <input required value={form.name} onChange={(e) => update("name", e.target.value)} className="input" placeholder="Acme Office Supplies Ltd" />
        </Field>
        <Field label="Contact email">
          <input required type="email" value={form.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} className="input" placeholder="sales@acme.com" />
        </Field>
        <Field label="Category">
          <input required value={form.category} onChange={(e) => update("category", e.target.value)} className="input" placeholder="IT Hardware" />
        </Field>
        <Field label="Business justification">
          <textarea
            required
            rows={4}
            value={form.businessJustification}
            onChange={(e) => update("businessJustification", e.target.value)}
            className="input resize-none"
            placeholder="Why is this supplier needed? What will be purchased from them?"
          />
        </Field>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-[#1A2A52] text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-[#243766] transition-colors disabled:opacity-50"
        >
          {loading ? "Submitting…" : "Submit for approval"}
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
