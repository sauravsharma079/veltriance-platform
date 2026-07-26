"use client";
import { useState as useOnboardState } from "react";
import SupplierOnboardingBot from "@/components/SupplierOnboardingBot";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, Plus, Star, AlertTriangle, CheckCircle, BarChart3, Building2, RefreshCw, AlertCircle } from "lucide-react";

type Supplier = {
  id: string; name: string; code: string | null; category: string | null;
  tier: string | null; status: string; preferred: boolean;
  rating: number | null; riskScore: number | null; riskLevel: string | null;
  country: string | null; city: string | null; contactEmail: string | null;
  onboardingStage: string | null; contactName: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700 border border-amber-200",
  BLOCKED: "bg-red-50 text-red-700 border border-red-200",
  INACTIVE: "bg-gray-100 text-gray-500 border border-gray-200",
};

const RISK_COLORS: Record<string, string> = {
  LOW: "text-emerald-600", MEDIUM: "text-amber-600", HIGH: "text-orange-600", CRITICAL: "text-red-600",
};

function ScoreBar({ value }: { value: number | null }) {
  if (value == null) return <span className="text-gray-300 text-xs">—</span>;
  const pct = Math.min(Math.max(value, 0), 100);
  const color = pct >= 90 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-600 tabular-nums">{Math.round(pct)}</span>
    
      {showOnboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-[540px] h-[640px] rounded-2xl overflow-hidden shadow-2xl">
            <SupplierOnboardingBot onClose={() => { setShowOnboarding(false); load(); }} />
          </div>
        </div>
      )}
    
    </div>
  );
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showOnboarding, setShowOnboarding] = useOnboardState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/suppliers?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text.trim()) { setSuppliers([]); return; }
      const data = JSON.parse(text);
      setSuppliers(Array.isArray(data.suppliers) ? data.suppliers : []);
    } catch (e: any) {
      setError(e.message || "Failed to load suppliers");
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const stats = {
    active: suppliers.filter(s => s.status === "ACTIVE").length,
    preferred: suppliers.filter(s => s.preferred).length,
    highRisk: suppliers.filter(s => s.riskLevel === "HIGH" || s.riskLevel === "CRITICAL").length,
    avgRating: suppliers.length ? Math.round(suppliers.reduce((a, s) => a + (s.rating ?? 0), 0) / suppliers.length) : 0,
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Supplier Management</h1>
            <p className="text-xs text-gray-400 mt-0.5">Manage your approved vendor network</p>
          </div>
          <button onClick={() => setShowOnboarding(true)}
            className="flex items-center gap-2 bg-[#1A2A52] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#243766]">
            <Plus className="size-3.5" />Onboard Supplier
          </button>
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Active Suppliers", value: stats.active, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Preferred Vendors", value: stats.preferred, icon: Star, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "High Risk", value: stats.highRisk, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
            { label: "Avg. Rating", value: stats.avgRating || "—", icon: BarChart3, color: "text-[#1A2A52]", bg: "bg-[#1A2A52]/8" },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`size-10 ${s.bg} rounded-xl flex items-center justify-center`}>
                  <s.icon className={`size-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-[10px] text-gray-400">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search suppliers..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-[#1A2A52]" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#1A2A52]">
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING_APPROVAL">Pending</option>
            <option value="INACTIVE">Inactive</option>
            <option value="BLOCKED">Blocked</option>
          </select>
          <button onClick={load} className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50">
            <RefreshCw className="size-3" />Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl mb-4">
            <AlertCircle className="size-4 shrink-0" />{error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
            <div className="col-span-3">Supplier</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-1">Tier</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2">Rating</div>
            <div className="col-span-2">Risk</div>
            <div className="col-span-1">Contact</div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="size-8 border-2 border-[#1A2A52]/20 border-t-[#1A2A52] rounded-full animate-spin" />
            </div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-16">
              <Building2 className="size-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-400">No suppliers found</p>
              <p className="text-xs text-gray-300 mt-1">Try adjusting your filters or onboard a new supplier</p>
            </div>
          ) : (
            suppliers.map(s => (
              <Link key={s.id} href={`/dashboard/suppliers/${s.id}`}
                className="grid grid-cols-12 gap-3 px-5 py-3.5 border-b border-gray-50 last:border-0 items-center hover:bg-gray-50/60 transition-colors">
                <div className="col-span-3 flex items-center gap-2.5">
                  <div className="size-9 rounded-xl bg-[#1A2A52]/8 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-[#1A2A52]">{(s.name || "?").charAt(0)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{s.name}</p>
                    <p className="text-[10px] text-gray-400">{s.code ?? "—"} · {s.city ?? s.country ?? "—"}</p>
                  </div>
                  {s.preferred && <Star className="size-3 text-amber-400 fill-amber-400 shrink-0" />}
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-600 truncate">{s.category ?? "—"}</p>
                </div>
                <div className="col-span-1">
                  <span className="text-[10px] font-medium text-gray-600">{s.tier ?? "—"}</span>
                </div>
                <div className="col-span-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[s.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {s.status === "PENDING_APPROVAL" ? "Pending" : s.status === "ACTIVE" ? "Active" : s.status}
                  </span>
                </div>
                <div className="col-span-2">
                  <ScoreBar value={s.rating} />
                </div>
                <div className="col-span-2">
                  {s.riskLevel ? (
                    <div className="flex items-center gap-1.5">
                      <div className={`size-1.5 rounded-full ${s.riskLevel === "LOW" ? "bg-emerald-500" : s.riskLevel === "MEDIUM" ? "bg-amber-500" : "bg-red-500"}`} />
                      <span className={`text-xs font-medium ${RISK_COLORS[s.riskLevel] ?? "text-gray-500"}`}>{s.riskLevel}</span>
                      {s.riskScore != null && <span className="text-[10px] text-gray-400">({s.riskScore})</span>}
                    </div>
                  ) : <span className="text-gray-300 text-xs">—</span>}
                </div>
                <div className="col-span-1">
                  <p className="text-[10px] text-gray-400 truncate">{s.contactName ?? "—"}</p>
                </div>
              </Link>
            ))
          )}
        </div>

        {!loading && suppliers.length > 0 && (
          <p className="text-xs text-gray-400 mt-3 text-center">{suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""} shown</p>
        )}
      </div>
    
      {showOnboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-[540px] h-[640px] rounded-2xl overflow-hidden shadow-2xl">
            <SupplierOnboardingBot onClose={() => { setShowOnboarding(false); load(); }} />
          </div>
        </div>
      )}
    
    </div>
  );
}
