"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "SGD", "AED"];

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    employeeId: "",
    department: "",
    businessUnit: "",
    costCenter: "",
    country: "",
    currency: "USD",
  });

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, onboardingComplete: true }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Something went wrong. Please try again.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] px-4 py-10">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-8">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Complete your profile</h1>
        <p className="text-sm text-gray-500 mb-6">
          This information is used to route your requests to the right approver and cost center.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Employee ID">
              <input
                value={form.employeeId}
                onChange={(e) => update("employeeId", e.target.value)}
                className="input"
                placeholder="EMP-1042"
              />
            </Field>
            <Field label="Country">
              <input
                value={form.country}
                onChange={(e) => update("country", e.target.value)}
                className="input"
                placeholder="India"
              />
            </Field>
          </div>

          <Field label="Department">
            <input
              required
              value={form.department}
              onChange={(e) => update("department", e.target.value)}
              className="input"
              placeholder="Engineering"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Business Unit">
              <input
                value={form.businessUnit}
                onChange={(e) => update("businessUnit", e.target.value)}
                className="input"
                placeholder="Product & Technology"
              />
            </Field>
            <Field label="Cost Center">
              <input
                required
                value={form.costCenter}
                onChange={(e) => update("costCenter", e.target.value)}
                className="input"
                placeholder="CC-4410"
              />
            </Field>
          </div>

          <Field label="Currency">
            <select
              value={form.currency}
              onChange={(e) => update("currency", e.target.value)}
              className="input"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1A2A52] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#243766] transition-colors disabled:opacity-50"
          >
            {loading ? "Saving…" : "Continue to dashboard"}
          </button>
        </form>
      </div>
      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus {
          border-color: #1a2a52;
          box-shadow: 0 0 0 1px #1a2a52;
        }
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
