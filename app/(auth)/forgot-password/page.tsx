"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    const res = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    setLoading(false);
    if (!res.ok) { setError((await res.json().catch(() => null))?.error ?? "Something went wrong. Please try again."); return; }
    setDone(true);
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-1">Forgot your password?</h1>
      {done ? (
        <>
          <p className="text-sm text-gray-600 mt-3">If an account exists for <strong>{email}</strong>, we&apos;ve emailed a link to choose a new password. It can take a minute — check your spam folder too.</p>
          <p className="text-sm text-gray-500 mt-6"><Link href="/login" className="text-[#1A2A52] font-medium hover:underline">Back to sign in</Link></p>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-6">Enter your work email and we&apos;ll send you a link to set a new one. This is also how to set a password if you haven&apos;t chosen one yet.</p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="email" required placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-[#1A2A52] focus:ring-1 focus:ring-[#1A2A52]" />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button disabled={loading} className="w-full bg-[#1A2A52] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#243766] transition-colors disabled:opacity-50">{loading ? "Sending…" : "Email me a link"}</button>
          </form>
          <p className="text-sm text-gray-500 mt-6"><Link href="/login" className="text-[#1A2A52] font-medium hover:underline">Back to sign in</Link></p>
        </>
      )}
    </div>
  );
}
