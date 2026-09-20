"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Stage = "checking" | "form" | "expired";

/**
 * Where people choose a password: straight after accepting an invitation (they arrive already
 * signed in), or from a "forgot password" email (a one-time token in the URL signs them in).
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("checking");
  const [welcome, setWelcome] = useState(false);
  const [next, setNext] = useState("/dashboard");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const q = new URLSearchParams(window.location.search);
      const target = q.get("next");
      // Only ever send people somewhere inside this app.
      if (target && target.startsWith("/") && !target.startsWith("//")) setNext(target);
      setWelcome(target === "/onboarding");
      const supabase = createClient();
      const tokenHash = q.get("token_hash");
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
        if (error) { setStage("expired"); return; }
        window.history.replaceState(null, "", window.location.pathname + (target ? `?next=${encodeURIComponent(target)}` : "")); // the token is spent — don't leave it in the address bar
      }
      const { data } = await supabase.auth.getUser();
      setStage(data.user ? "form" : "expired");
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Choose a password of at least 8 characters."); return; }
    if (password !== confirm) { setError("The two passwords don't match."); return; }
    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push(next);
    router.refresh();
  }

  const input = "w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-[#1A2A52] focus:ring-1 focus:ring-[#1A2A52]";
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        {stage === "checking" && <p className="text-sm text-gray-400">One moment…</p>}
        {stage === "expired" && (
          <>
            <h1 className="text-lg font-semibold text-gray-900 mb-1">This link has expired</h1>
            <p className="text-sm text-gray-500">Links can only be used once and don&apos;t last long. Request a new one and we&apos;ll email it straight away.</p>
            <Link href="/forgot-password" className="inline-block mt-5 bg-[#1A2A52] text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[#243766]">Email me a new link</Link>
          </>
        )}
        {stage === "form" && (
          <>
            <h1 className="text-lg font-semibold text-gray-900 mb-1">{welcome ? "Welcome — choose your password" : "Choose a new password"}</h1>
            <p className="text-sm text-gray-500 mb-6">{welcome ? "You'll use it, with your email, to sign in from now on." : "Use at least 8 characters."}</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input type="password" required minLength={8} autoComplete="new-password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
              <input type="password" required minLength={8} autoComplete="new-password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button disabled={loading} className="w-full bg-[#1A2A52] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#243766] transition-colors disabled:opacity-50">{loading ? "Saving…" : welcome ? "Continue" : "Save password"}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
