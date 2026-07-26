"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Plus, Search, ChevronRight, Star,
  CheckCircle2, Clock, RefreshCw, AlertCircle,
} from "lucide-react";
import { SupplierAgent } from "@/components/SupplierAgent";

type Supplier = {
  id: string; name: string; code: string; status: string;
  onboardingStage: string | null; category: string | null;
  city: string | null; country: string | null; tier: string | null;
  preferred: boolean; rating: number | null; riskLevel: string | null;
  onTimeDelivery: number | null; qualityScore: number | null;
  onboardingProfile: { completionScore: number } | null;
  _count: { documents: number };
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  ACTIVE:           { label: "Active",   color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  PENDING_APPROVAL: { label: "Pending",  color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",    dot: "bg-amber-400"   },
  BLOCKED:          { label: "Blocked",  color: "text-red-700",     bg: "bg-red-50 border-red-200",        dot: "bg-red-500"     },
  INACTIVE:         { label: "Inactive", color: "text-gray-500",    bg: "bg-gray-100 border-gray-200",     dot: "bg-gray-400"    },
};

const STAGE_CFG: Record<string, { label: string; pct: number; color: string }> = {
  REGISTRATION:         { label: "Registration",    pct: 16,  color: "bg-blue-400"    },
  VALIDATION:           { label: "Validation",      pct: 33,  color: "bg-indigo-400"  },
  RISK_ASSESSMENT:      { label: "Risk Assessment", pct: 50,  color: "bg-amber-400"   },
  COMPLIANCE_REVIEW:    { label: "Compliance",      pct: 66,  color: "bg-orange-400"  },
  PROCUREMENT_APPROVAL: { label: "Approval",        pct: 83,  color: "bg-purple-400"  },
  ACTIVE:               { label: "Active",          pct: 100, color: "bg-emerald-500" },
};

const PIPELINE_STAGES = [
  "REGISTRATION", "VALIDATION", "RISK_ASSESSMENT",
  "COMPLIANCE_REVIEW", "PROCUREMENT_APPROVAL",
];

function AddModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState({
    name: "", contactEmail: "", contactName: "", contactPhone: "",
    category: "", city: "", website: "", businessJustification: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const CATS = [
    "IT Hardware", "Software & Licenses", "Cloud Services", "Consulting Services",
    "Office Supplies", "Facilities", "Logistics", "Marketing", "Professional Services", "Other",
  ];

  async function submit() {
    if (!form.name.trim()) { setError("Company name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (res.ok) {
        onCreated(d.supplier.id);
      } else {
        setError(d.error ?? "Failed to create supplier");
        setSaving(false);
      }
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-h-[90vh] flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Add New Supplier</h2>
            <p className="text-xs text-gray-400 mt-0.5">Begin the supplier onboarding process</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Company name *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && submit()}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#1A2A52] focus:ring-1 focus:ring-[#1A2A52]/20"
              placeholder="e.g. Infosys Limited"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Contact name</label>
              <input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#1A2A52]"
                placeholder="Rajesh Kumar" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Contact email</label>
              <input type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#1A2A52]"
                placeholder="vendor@company.com" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Phone</label>
              <input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#1A2A52]"
                placeholder="+91-XXXXXXXXXX" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#1A2A52]">
                <option value="">Select category…</option>
                {CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">City</label>
              <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#1A2A52]"
                placeholder="Hyderabad" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Website</label>
              <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#1A2A52]"
                placeholder="https://company.com" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Business justification</label>
            <textarea value={form.businessJustification} onChange={e => setForm(f => ({ ...f, businessJustification: e.target.value }))}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#1A2A52] resize-none"
              placeholder="Why is this supplier needed?" />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50 transition-colors"
          >
            {saving ? "Creating…" : "Create & Start Onboarding"}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SuppliersPage() {
  const router  = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [view, setView]           = useState<"list" | "pipeline">("list");
  const [showAdd, setShowAdd]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/suppliers");
      if (res.ok) {
        const d = await res.json();
        setSuppliers(d.suppliers ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = suppliers.filter(s => {
    const matchStatus = statusFilter === "ALL" || s.status === statusFilter;
    const matchSearch = !search
      || s.name.toLowerCase().includes(search.toLowerCase())
      || (s.category ?? "").toLowerCase().includes(search.toLowerCase())
      || (s.code ?? "").toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const activeCount  = suppliers.filter(s => s.status === "ACTIVE").length;
  const pendingCount = suppliers.filter(s => s.status === "PENDING_APPROVAL").length;
  const blockedCount = suppliers.filter(s => s.status === "BLOCKED").length;

  return (
    <div className="min-h-screen bg-[#F7F8FA]">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-5">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Supplier Management</h1>
            <p className="text-sm text-gray-400 mt-0.5">Onboard, enable, and manage your supplier network</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="flex items-center gap-2 text-sm text-gray-500 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="size-4" /> Refresh
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 bg-[#1A2A52] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#243766] shadow-sm transition-colors"
            >
              <Plus className="size-4" /> Add Supplier
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="flex items-center gap-8 pt-4 border-t border-gray-100">
          {[
            { label: "Total",   value: suppliers.length, icon: Building2,    c: "text-[#1A2A52]",   bg: "bg-[#1A2A52]/8" },
            { label: "Active",  value: activeCount,      icon: CheckCircle2, c: "text-emerald-700", bg: "bg-emerald-50"  },
            { label: "Pending", value: pendingCount,     icon: Clock,        c: "text-amber-700",   bg: "bg-amber-50"    },
            { label: "Blocked", value: blockedCount,     icon: AlertCircle,  c: "text-red-700",     bg: "bg-red-50"      },
          ].map(k => (
            <div key={k.label} className="flex items-center gap-3">
              <div className={`size-9 rounded-xl ${k.bg} flex items-center justify-center`}>
                <k.icon className={`size-4 ${k.c}`} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 leading-tight">{k.value}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">{k.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-8 flex">
        {[
          { id: "list"     as const, label: "All Suppliers"       },
          { id: "pipeline" as const, label: "Onboarding Pipeline" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`py-3.5 px-1 mr-6 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              view === t.id
                ? "border-[#1A2A52] text-[#1A2A52]"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="px-8 py-4 flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search suppliers…"
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1A2A52] bg-white w-60"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1A2A52] bg-white"
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING_APPROVAL">Pending</option>
          <option value="BLOCKED">Blocked</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} supplier{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <div className="px-8 pb-28">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="size-8 border-2 border-[#1A2A52]/20 border-t-[#1A2A52] rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl px-8 py-20 text-center shadow-sm">
              <Building2 className="size-12 text-gray-200 mx-auto mb-4" />
              <p className="text-base font-semibold text-gray-500 mb-2">
                {suppliers.length === 0 ? "No suppliers yet" : "No suppliers match your filters"}
              </p>
              <p className="text-sm text-gray-400 mb-6">
                {suppliers.length === 0
                  ? "Add your first supplier using the button above, or use the Supplier Assistant (bottom-right 🤖) to onboard one conversationally."
                  : "Try adjusting your search or status filter."}
              </p>
              {suppliers.length === 0 && (
                <button
                  onClick={() => setShowAdd(true)}
                  className="inline-flex items-center gap-2 bg-[#1A2A52] text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[#243766] transition-colors"
                >
                  <Plus className="size-4" /> Add First Supplier
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50/70 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                <div className="col-span-3">Supplier</div>
                <div className="col-span-2">Category</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Performance</div>
                <div className="col-span-1 text-center">Docs</div>
                <div className="col-span-1">Stage</div>
                <div className="col-span-1" />
              </div>

              {filtered.map(s => {
                const stCfg    = STATUS_CFG[s.status] ?? STATUS_CFG.INACTIVE;
                const stageCfg = s.onboardingStage ? STAGE_CFG[s.onboardingStage] : null;

                return (
                  <div
                    key={s.id}
                    onClick={() => router.push(`/dashboard/suppliers/${s.id}`)}
                    className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-50 last:border-0 hover:bg-blue-50/20 cursor-pointer group transition-colors items-center"
                  >
                    {/* Name */}
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-gradient-to-br from-[#1A2A52]/10 to-[#C8A04D]/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-[#1A2A52]">{s.name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                          {s.preferred && <Star className="size-3 text-[#C8A04D] fill-[#C8A04D] shrink-0" />}
                        </div>
                        <p className="text-[10px] text-gray-400">{s.code} · {s.tier ?? "Untiered"}</p>
                      </div>
                    </div>

                    {/* Category */}
                    <div className="col-span-2">
                      <p className="text-xs font-medium text-gray-700 truncate">{s.category ?? "—"}</p>
                      <p className="text-[10px] text-gray-400">
                        {s.city ? `${s.city}, ${s.country ?? "India"}` : s.country ?? "—"}
                      </p>
                    </div>

                    {/* Status */}
                    <div className="col-span-2">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${stCfg.bg} ${stCfg.color}`}>
                        <span className={`size-1.5 rounded-full ${stCfg.dot}`} />
                        {stCfg.label}
                      </span>
                    </div>

                    {/* Performance */}
                    <div className="col-span-2 space-y-1">
                      {s.onTimeDelivery !== null && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-gray-400 w-11 shrink-0">Delivery</span>
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
                            <div
                              className={`h-1.5 rounded-full ${s.onTimeDelivery >= 90 ? "bg-emerald-500" : s.onTimeDelivery >= 70 ? "bg-amber-400" : "bg-red-400"}`}
                              style={{ width: `${s.onTimeDelivery}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-semibold text-gray-700">{s.onTimeDelivery}%</span>
                        </div>
                      )}
                      {s.qualityScore !== null && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-gray-400 w-11 shrink-0">Quality</span>
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
                            <div
                              className={`h-1.5 rounded-full ${s.qualityScore >= 90 ? "bg-emerald-500" : s.qualityScore >= 70 ? "bg-amber-400" : "bg-red-400"}`}
                              style={{ width: `${s.qualityScore}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-semibold text-gray-700">{s.qualityScore}%</span>
                        </div>
                      )}
                      {s.onTimeDelivery === null && s.qualityScore === null && (
                        <span className="text-[10px] text-gray-300">No reviews</span>
                      )}
                    </div>

                    {/* Docs */}
                    <div className="col-span-1 text-center">
                      <span className={`text-sm font-bold ${s._count.documents > 0 ? "text-gray-900" : "text-gray-300"}`}>
                        {s._count.documents}
                      </span>
                    </div>

                    {/* Stage */}
                    <div className="col-span-1">
                      {stageCfg && (
                        <>
                          <div className="h-1.5 bg-gray-100 rounded-full mb-1">
                            <div className={`h-1.5 rounded-full ${stageCfg.color}`} style={{ width: `${stageCfg.pct}%` }} />
                          </div>
                          <p className="text-[9px] text-gray-400 truncate">{stageCfg.label}</p>
                        </>
                      )}
                    </div>

                    {/* Arrow */}
                    <div className="col-span-1 flex justify-end">
                      <ChevronRight className="size-4 text-gray-300 group-hover:text-[#1A2A52] transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── PIPELINE VIEW ── */}
      {view === "pipeline" && (
        <div className="px-8 pb-28">
          <div className="grid grid-cols-5 gap-4">
            {PIPELINE_STAGES.map(stageKey => {
              const stageCfg  = STAGE_CFG[stageKey];
              const stageSups = suppliers.filter(s => s.onboardingStage === stageKey);
              return (
                <div key={stageKey}>
                  <div className="flex items-center gap-2 mb-3 bg-white border border-gray-100 rounded-xl px-3 py-2.5 shadow-sm">
                    <div className={`size-2.5 rounded-full ${stageCfg.color}`} />
                    <p className="text-xs font-bold text-gray-700 flex-1 truncate">{stageCfg.label}</p>
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                      {stageSups.length}
                    </span>
                  </div>
                  <div className="space-y-2 min-h-[80px]">
                    {stageSups.length === 0 ? (
                      <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center">
                        <p className="text-[10px] text-gray-300">Empty</p>
                      </div>
                    ) : stageSups.map(s => (
                      <div
                        key={s.id}
                        onClick={() => router.push(`/dashboard/suppliers/${s.id}`)}
                        className="bg-white border border-gray-100 rounded-xl p-3.5 cursor-pointer hover:shadow-md hover:border-[#1A2A52]/20 transition-all group"
                      >
                        <div className="flex items-start gap-2 mb-2.5">
                          <div className="size-8 rounded-lg bg-[#1A2A52]/8 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-[#1A2A52]">{s.name.charAt(0)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-900 truncate leading-tight">{s.name}</p>
                            <p className="text-[9px] text-gray-400 truncate">{s.category ?? "—"}</p>
                          </div>
                        </div>
                        {s.onboardingProfile && (
                          <div>
                            <div className="flex justify-between text-[9px] text-gray-400 mb-1">
                              <span>Profile</span>
                              <span>{s.onboardingProfile.completionScore}%</span>
                            </div>
                            <div className="h-1 bg-gray-100 rounded-full">
                              <div
                                className={`h-1 rounded-full ${stageCfg.color}`}
                                style={{ width: `${s.onboardingProfile.completionScore}%` }}
                              />
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-2.5">
                          <span className="text-[9px] text-gray-400">{s._count.documents} doc{s._count.documents !== 1 ? "s" : ""}</span>
                          <ChevronRight className="size-3 text-gray-300 group-hover:text-[#1A2A52]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onCreated={id => {
            setShowAdd(false);
            load();
            router.push(`/dashboard/suppliers/${id}`);
          }}
        />
      )}

      {/* ── SUPPLIER ONBOARDING BOT ── */}
      <SupplierAgent onRefresh={load} />
    </div>
  );
}
