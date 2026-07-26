"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Search, ArrowRight, Plus, Clock, Building2, ChevronRight, Globe } from "lucide-react";

type Org = { name: string; slug: string };

const RECENT_KEY = "vt_recent_workspaces";

function getRecentWorkspaces(): Org[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveRecentWorkspace(org: Org) {
  const existing = getRecentWorkspaces().filter(o => o.slug !== org.slug);
  localStorage.setItem(RECENT_KEY, JSON.stringify([org, ...existing].slice(0, 5)));
}

export default function LandingPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Org[]>([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const [recentWorkspaces, setRecentWorkspaces] = useState<Org[]>([]);
  const [rootDomain, setRootDomain] = useState("veltriance-platform.com");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRootDomain(window.location.host);
    setRecentWorkspaces(getRecentWorkspaces());
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const res = await fetch(`/api/orgs?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setResults(data.orgs ?? []);
    setSearching(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 250);
    return () => clearTimeout(t);
  }, [query, search]);

  function goToWorkspace(org: Org) {
    saveRecentWorkspace(org);
    const port = window.location.port;
    const portStr = port && window.location.hostname === "localhost" ? `:${port}` : "";
    const base = rootDomain.replace(/:\d+$/, "");
    const proto = window.location.protocol;
    window.location.href = `${proto}//${org.slug}.${base}${portStr}/login`;
  }

  const showDropdown = focused && (query.length >= 2 || recentWorkspaces.length > 0);
  const showResults = query.length >= 2;

  return (
    <div className="min-h-screen bg-[#0B0F19] flex flex-col">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-lg bg-gradient-to-br from-[#1A2A52] to-[#C8A04D]" />
          <span className="text-white font-semibold tracking-tight">Veltriance</span>
          <span className="text-white/30 text-xs border border-white/20 rounded-full px-2 py-0.5">Enterprise Procurement</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/create-organization" className="text-sm text-white/60 hover:text-white transition-colors">
            Create workspace
          </Link>
          <a href="mailto:info@veltriance.com"
            className="text-sm font-medium bg-[#C8A04D] text-[#0B0F19] px-4 py-1.5 rounded-full hover:bg-[#d4aa55] transition-colors">
            Request demo
          </a>
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="text-center mb-10 max-w-xl">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3.5 py-1.5 text-xs text-white/60 mb-5">
            <Globe className="size-3 text-[#C8A04D]" />
            Enterprise Procurement Platform
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-3">
            Sign in to your<br />
            <span className="text-[#C8A04D]">Veltriance workspace</span>
          </h1>
          <p className="text-white/50 text-sm">
            Enter your organisation name or workspace URL to continue.
          </p>
        </div>

        {/* Search box */}
        <div className="w-full max-w-md relative">
          <div className={`relative flex items-center bg-white/5 border rounded-2xl transition-all ${
            focused ? "border-[#C8A04D] shadow-[0_0_0_3px_rgba(200,160,77,0.15)]" : "border-white/15"
          }`}>
            <Search className={`absolute left-4 size-4 transition-colors ${focused ? "text-[#C8A04D]" : "text-white/40"}`} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder="Search by organisation name or URL…"
              className="w-full bg-transparent text-white placeholder:text-white/30 text-sm pl-11 pr-4 py-4 outline-none rounded-2xl"
            />
            {searching && (
              <div className="absolute right-4 size-4 border-2 border-white/20 border-t-[#C8A04D] rounded-full animate-spin" />
            )}
          </div>

          {/* Dropdown */}
          {showDropdown && (
            <div className="absolute top-full mt-2 w-full bg-[#141826] border border-white/15 rounded-2xl overflow-hidden shadow-2xl z-10">
              {showResults ? (
                results.length > 0 ? (
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider px-4 pt-3 pb-1">Results</p>
                    {results.map(org => (
                      <button key={org.slug} onClick={() => goToWorkspace(org)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-lg bg-[#1A2A52] flex items-center justify-center shrink-0">
                            <span className="text-[#C8A04D] text-xs font-bold">{org.name[0].toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{org.name}</p>
                            <p className="text-xs text-white/40">{org.slug}.{rootDomain.replace(/:\d+$/, "")}</p>
                          </div>
                        </div>
                        <ChevronRight className="size-4 text-white/30" />
                      </button>
                    ))}
                  </div>
                ) : !searching ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-white/50">No workspace found for &ldquo;{query}&rdquo;</p>
                    <Link href="/create-organization"
                      className="inline-flex items-center gap-1.5 text-xs text-[#C8A04D] mt-2 hover:underline">
                      <Plus className="size-3" /> Create &ldquo;{query}&rdquo; as a new workspace
                    </Link>
                  </div>
                ) : null
              ) : recentWorkspaces.length > 0 ? (
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider px-4 pt-3 pb-1 flex items-center gap-1.5">
                    <Clock className="size-3" /> Recently accessed
                  </p>
                  {recentWorkspaces.map(org => (
                    <button key={org.slug} onClick={() => goToWorkspace(org)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg bg-[#1A2A52] flex items-center justify-center shrink-0">
                          <span className="text-[#C8A04D] text-xs font-bold">{org.name[0].toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{org.name}</p>
                          <p className="text-xs text-white/40">{org.slug}.{rootDomain.replace(/:\d+$/, "")}</p>
                        </div>
                      </div>
                      <ChevronRight className="size-4 text-white/30" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* Direct URL entry hint */}
          {query.length > 0 && !query.includes(" ") && query.length >= 2 && (
            <button
              onClick={() => goToWorkspace({ name: query, slug: query.toLowerCase() })}
              className="mt-2 w-full flex items-center justify-between text-xs text-white/40 hover:text-white/60 transition-colors px-1">
              <span>Go directly to <strong className="text-white/60">{query.toLowerCase()}.{rootDomain.replace(/:\d+$/, "")}</strong></span>
              <ArrowRight className="size-3.5" />
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 w-full max-w-md my-8">
          <div className="h-px bg-white/10 flex-1" />
          <span className="text-xs text-white/30">or</span>
          <div className="h-px bg-white/10 flex-1" />
        </div>

        {/* Action cards */}
        <div className="grid sm:grid-cols-2 gap-3 w-full max-w-md">
          <Link href="/create-organization"
            className="group flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-4 hover:border-[#C8A04D]/50 hover:bg-white/8 transition-all">
            <div className="size-9 rounded-xl bg-[#C8A04D]/15 flex items-center justify-center shrink-0">
              <Plus className="size-4.5 text-[#C8A04D]" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Create workspace</p>
              <p className="text-xs text-white/40">Set up a new organisation</p>
            </div>
          </Link>

          <a href="mailto:info@veltriance.com?subject=Demo Request"
            className="group flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-4 hover:border-white/20 hover:bg-white/8 transition-all">
            <div className="size-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Building2 className="size-4.5 text-white/60" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Request a demo</p>
              <p className="text-xs text-white/40">See it in action first</p>
            </div>
          </a>
        </div>

        {/* Trusted by */}
        <p className="mt-12 text-xs text-white/20 text-center">
          Trusted by procurement teams at MNCs and Fortune 500 companies
        </p>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-4 flex items-center justify-between text-xs text-white/30">
        <span>© {new Date().getFullYear()} Veltriance. All rights reserved.</span>
        <div className="flex items-center gap-4">
          <a href="https://veltriance.com/privacy" className="hover:text-white/50 transition-colors">Privacy</a>
          <a href="https://veltriance.com/terms" className="hover:text-white/50 transition-colors">Terms</a>
          <a href="mailto:info@veltriance.com" className="hover:text-white/50 transition-colors">Contact</a>
        </div>
      </footer>
    </div>
  );
}
