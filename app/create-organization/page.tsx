"use client";

import { useState, useEffect } from "react";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 32);
}

export default function CreateOrganizationPage() {
  const [organizationName, setOrganizationName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [rootDomain, setRootDomain] = useState("veltriance-platform.com");

  // Read the actual host only after hydration to avoid server/client mismatch
  useEffect(() => {
    setRootDomain(window.location.host);
  }, []);

  function handleOrgNameChange(value: string) {
    setOrganizationName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationName, slug, name, email, password }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Please check the form and try again.");
      return;
    }

    if (data.immediate) {
      const protocol = window.location.protocol;
      const portSuffix = window.location.port && window.location.hostname === "localhost" ? `:${window.location.port}` : "";
      const baseHost = rootDomain.replace(/:\d+$/, "");
      window.location.href = `${protocol}//${data.slug}.${baseHost}${portSuffix}/login`;
      return;
    }

    setPendingConfirmation(true);
  }

  if (pendingConfirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] px-4">
        <div className="w-full max-w-sm text-center bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h1>
          <p className="text-sm text-gray-500">
            We&apos;ve sent a confirmation link to <strong>{email}</strong>. Click it to finish setting up your workspace at{" "}
            <strong>{slug}.{rootDomain.replace(/:\d+$/, "")}</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="size-8 rounded bg-gradient-to-br from-[#1A2A52] to-[#C8A04D] mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-white">Create your workspace</h1>
          <p className="text-sm text-white/40 mt-1">Set up Veltriance Procurement for your company.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-8 space-y-3">
          <Field label="Company name">
            <input
              required
              value={organizationName}
              onChange={(e) => handleOrgNameChange(e.target.value)}
              className="input"
              placeholder="Acme Corporation"
            />
          </Field>

          <Field label="Workspace URL">
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:border-[#1A2A52] focus-within:ring-1 focus-within:ring-[#1A2A52]">
              <input
                required
                value={slug}
                onChange={(e) => { setSlug(slugify(e.target.value)); setSlugEdited(true); }}
                className="flex-1 px-3.5 py-2.5 text-sm outline-none"
                placeholder="acme"
              />
              <span className="px-3 text-xs text-gray-400 whitespace-nowrap">.{rootDomain.replace(/:\d+$/, "")}</span>
            </div>
          </Field>

          <div className="h-px bg-gray-100 !my-5" />

          <Field label="Your name">
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Jane Doe" />
          </Field>
          <Field label="Work email">
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="jane@acme.com" />
          </Field>
          <Field label="Password">
            <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="Min 8 characters" />
          </Field>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1A2A52] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#243766] transition-colors disabled:opacity-50 !mt-5"
          >
            {loading ? "Creating workspace…" : "Create workspace"}
          </button>
          <p className="text-xs text-gray-400 text-center !mt-3">
            You&apos;ll be the first Admin for this workspace — no manual setup needed afterward.
          </p>
        </form>
      </div>
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
