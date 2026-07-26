"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Building2, ShoppingCart, X, Command } from "lucide-react";

type Result = { id: string; type: string; title: string; sub: string; status: string; href: string };

const TYPE_ICON: Record<string, React.ReactNode> = {
  requisition: <FileText className="size-4 text-[#1A2A52]" />,
  supplier: <Building2 className="size-4 text-[#0D9488]" />,
  po: <ShoppingCart className="size-4 text-[#C8A04D]" />,
};

const TYPE_LABEL: Record<string, string> = {
  requisition: "Requisition", supplier: "Supplier", po: "Purchase Order",
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "text-green-600", APPROVED: "text-green-600",
  PENDING_APPROVAL: "text-amber-600", MANAGER_APPROVAL: "text-amber-600",
  REJECTED: "text-red-500", DRAFT: "text-gray-400",
  SENT: "text-blue-600", BLOCKED: "text-red-500",
};

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(v => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQ(""); setResults([]); setSelected(0); }
  }, [open]);

  const search = useCallback(async (query: string) => {
    if (query.length < 2) { setResults([]); return; }
    setLoading(true);
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setResults(data.results ?? []);
    setSelected(0);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(q), 200);
    return () => clearTimeout(t);
  }, [q, search]);

  function navigate(href: string) {
    router.push(href);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[selected]) navigate(results[selected].href);
  }

  const grouped = results.reduce<Record<string, Result[]>>((acc, r) => {
    (acc[r.type] = acc[r.type] ?? []).push(r);
    return acc;
  }, {});

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <Search className="size-4.5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search requisitions, suppliers, purchase orders…"
            className="flex-1 text-sm text-gray-800 outline-none placeholder:text-gray-400"
          />
          {loading && <div className="size-4 border-2 border-gray-200 border-t-[#1A2A52] rounded-full animate-spin shrink-0" />}
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
            <X className="size-4" />
          </button>
        </div>

        {/* Results */}
        {q.length >= 2 && (
          <div className="max-h-96 overflow-y-auto py-2">
            {results.length === 0 && !loading ? (
              <p className="text-sm text-gray-400 text-center py-8">No results for &ldquo;{q}&rdquo;</p>
            ) : (
              Object.entries(grouped).map(([type, items]) => (
                <div key={type} className="mb-1">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider px-4 py-1.5 font-medium">{TYPE_LABEL[type]}</p>
                  {items.map(item => {
                    const idx = results.indexOf(item);
                    return (
                      <button key={item.id} onClick={() => navigate(item.href)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${selected === idx ? "bg-[#1A2A52]/5" : "hover:bg-gray-50"}`}>
                        <div className="size-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                          {TYPE_ICON[type]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                          <p className="text-xs text-gray-400 truncate">{item.sub}</p>
                        </div>
                        <span className={`text-[10px] font-medium capitalize shrink-0 ${STATUS_COLOR[item.status] ?? "text-gray-400"}`}>
                          {item.status.replace(/_/g, " ").toLowerCase()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer hint */}
        {q.length < 2 && (
          <div className="px-4 py-4 text-xs text-gray-400 flex items-center gap-4">
            <span className="flex items-center gap-1"><kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">↑↓</kbd> navigate</span>
            <span className="flex items-center gap-1"><kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">↵</kbd> open</span>
            <span className="flex items-center gap-1"><kbd className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">Esc</kbd> close</span>
          </div>
        )}
      </div>
    </div>
  );
}
