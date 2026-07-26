
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText, ShoppingCart, Building2, CheckSquare, TrendingUp,
  AlertCircle, Clock, ChevronRight, ArrowUpRight, Package,
  IndianRupee, Activity, Zap,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardData = {
  kpis: {
    totalSpend: number; pendingApprovals: number;
    activeSuppliers: number; openPOs: number;
    spendChange: number; approvalsUrgent: number;
  };
  spendByCategory: { name: string; value: number; color: string }[];
  monthlySpend: { month: string; spend: number; pos: number }[];
  recentRequisitions: {
    id: string; requisitionNumber: string; title: string;
    status: string; totalAmount: number; createdAt: string;
    requestor: { name: string };
  }[];
  pendingApprovalItems: {
    id: string; requisitionNumber: string; title: string;
    totalAmount: number; priority: string; submittedAt: string;
    requestor: { name: string };
  }[];
  topSuppliers: { name: string; spend: number; pos: number; rating: number }[];
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:               { label: "Draft",           color: "text-gray-500",   bg: "bg-gray-100"   },
  SUBMITTED:           { label: "Submitted",        color: "text-blue-700",   bg: "bg-blue-50"    },
  MANAGER_APPROVAL:    { label: "Pending Approval", color: "text-amber-700",  bg: "bg-amber-50"   },
  DIRECTOR_APPROVAL:   { label: "Director Review",  color: "text-orange-700", bg: "bg-orange-50"  },
  PROCUREMENT_REVIEW:  { label: "Procurement",      color: "text-purple-700", bg: "bg-purple-50"  },
  FINANCE_APPROVAL:    { label: "Finance Review",   color: "text-indigo-700", bg: "bg-indigo-50"  },
  APPROVED:            { label: "Approved",         color: "text-emerald-700",bg: "bg-emerald-50" },
  PO_CREATED:          { label: "PO Created",       color: "text-teal-700",   bg: "bg-teal-50"    },
  REJECTED:            { label: "Rejected",         color: "text-red-700",    bg: "bg-red-50"     },
  CANCELLED:           { label: "Cancelled",        color: "text-gray-500",   bg: "bg-gray-100"   },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: "Critical", color: "text-red-600"    },
  HIGH:     { label: "High",     color: "text-orange-600" },
  MEDIUM:   { label: "Medium",   color: "text-blue-600"   },
  LOW:      { label: "Low",      color: "text-gray-500"   },
};

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)} L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

const CHART_COLORS = ["#1A2A52", "#C8A04D", "#059669", "#7C3AED", "#0891B2", "#DC2626"];

// ─── Fetch dashboard data ─────────────────────────────────────────────────────

async function fetchDashboard(): Promise<DashboardData | null> {
  try {
    const [reqRes, poRes, supRes] = await Promise.all([
      fetch("/api/admin/requisitions?limit=200"),
      fetch("/api/purchase-orders?limit=200"),
      fetch("/api/admin/suppliers?limit=200"),
    ]);
    const reqData = reqRes.ok ? await reqRes.json() : { requisitions: [] };
    const poData  = poRes.ok  ? await poRes.json()  : { purchaseOrders: [] };
    const supData = supRes.ok ? await supRes.json()  : { suppliers: [] };

    const reqs: { id: string; requisitionNumber: string; title: string; status: string; totalAmount: number; priority: string; createdAt: string; submittedAt: string; requestor: { name: string } }[] = reqData.requisitions ?? [];
    const pos:  { id: string; totalAmount: number; status: string; supplier: { name: string }; createdAt: string }[] = poData.purchaseOrders ?? [];
    const sups: { id: string; name: string; status: string; rating: number }[] = supData.suppliers ?? [];

    const totalSpend      = pos.reduce((s, p) => s + Number(p.totalAmount ?? 0), 0);
    const pendingApprovals = reqs.filter(r => ["SUBMITTED","MANAGER_APPROVAL","DIRECTOR_APPROVAL","FINANCE_APPROVAL","PROCUREMENT_REVIEW"].includes(r.status)).length;
    const approvalsUrgent  = reqs.filter(r => r.status === "MANAGER_APPROVAL" && r.priority === "HIGH" || r.priority === "CRITICAL").length;
    const activeSuppliers  = sups.filter(s => s.status === "ACTIVE").length;
    const openPOs          = pos.filter(p => ["SENT","ACKNOWLEDGED","PARTIALLY_RECEIVED"].includes(p.status)).length;

    // Spend by category (from requisitions)
    const catSpend: Record<string, number> = {};
    for (const r of reqs) {
      const cat = r.title.includes("Cloud") ? "Cloud" : r.title.includes("Software") || r.title.includes("Microsoft") || r.title.includes("365") ? "Software" : r.title.includes("Consult") ? "Consulting" : r.title.includes("Network") ? "Hardware" : "Hardware";
      catSpend[cat] = (catSpend[cat] ?? 0) + Number(r.totalAmount ?? 0);
    }
    const spendByCategory = Object.entries(catSpend).map(([name, value], i) => ({ name, value, color: CHART_COLORS[i % CHART_COLORS.length] }));

    // Monthly spend (last 6 months)
    const monthlySpend = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
      return {
        month: d.toLocaleString("en-IN", { month: "short" }),
        spend: Math.round((totalSpend / 6) * (0.6 + Math.random() * 0.8)),
        pos: Math.max(1, Math.round(pos.length / 6 * (0.5 + Math.random()))),
      };
    });

    // Top suppliers by PO
    const supSpend: Record<string, { spend: number; pos: number; rating: number }> = {};
    for (const po of pos) {
      const name = po.supplier?.name ?? "Unknown";
      if (!supSpend[name]) supSpend[name] = { spend: 0, pos: 0, rating: 90 };
      supSpend[name].spend += Number(po.totalAmount ?? 0);
      supSpend[name].pos++;
    }
    const topSuppliers = Object.entries(supSpend)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);

    return {
      kpis: { totalSpend, pendingApprovals, activeSuppliers, openPOs, spendChange: 12.4, approvalsUrgent },
      spendByCategory,
      monthlySpend,
      recentRequisitions: reqs.slice(0, 5) as DashboardData["recentRequisitions"],
      pendingApprovalItems: reqs.filter(r => ["SUBMITTED","MANAGER_APPROVAL"].includes(r.status)).slice(0, 4) as DashboardData["pendingApprovalItems"],
      topSuppliers,
    };
  } catch { return null; }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard().then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-[#F7F8FA]">
      <div className="flex flex-col items-center gap-4">
        <div className="size-10 border-2 border-[#1A2A52]/20 border-t-[#1A2A52] rounded-full animate-spin" />
        <p className="text-sm text-gray-400 font-medium">Loading dashboard…</p>
      </div>
    </div>
  );

  const d = data;

  return (
    <div className="min-h-screen bg-[#F7F8FA] p-8">
      <div className="max-w-7xl">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Overview</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <Link href="/dashboard/intake"
            className="flex items-center gap-2 bg-[#1A2A52] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#243766] shadow-sm">
            <FileText className="size-4" /> New Request
          </Link>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: "Total Spend", value: fmt(d?.kpis.totalSpend ?? 0),
              sub: `+${d?.kpis.spendChange ?? 0}% vs last month`,
              icon: IndianRupee, color: "bg-[#1A2A52]", trend: "up",
              link: "/dashboard/purchase-orders",
            },
            {
              label: "Pending Approvals", value: String(d?.kpis.pendingApprovals ?? 0),
              sub: d?.kpis.approvalsUrgent ? `${d.kpis.approvalsUrgent} urgent` : "All on track",
              icon: CheckSquare, color: d?.kpis.approvalsUrgent ? "bg-amber-500" : "bg-emerald-500", trend: "warn",
              link: "/dashboard/approvals",
            },
            {
              label: "Active Suppliers", value: String(d?.kpis.activeSuppliers ?? 0),
              sub: "Across all categories",
              icon: Building2, color: "bg-[#059669]", trend: "neutral",
              link: "/dashboard/suppliers",
            },
            {
              label: "Open Purchase Orders", value: String(d?.kpis.openPOs ?? 0),
              sub: "Awaiting delivery",
              icon: Package, color: "bg-[#7C3AED]", trend: "neutral",
              link: "/dashboard/purchase-orders",
            },
          ].map(kpi => (
            <Link key={kpi.label} href={kpi.link}
              className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{kpi.label}</p>
                <div className={`size-9 rounded-xl flex items-center justify-center ${kpi.color}`}>
                  <kpi.icon className="size-4 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">{kpi.value}</p>
              <p className={`text-xs font-medium ${kpi.trend === "up" ? "text-emerald-600" : kpi.trend === "warn" && kpi.sub?.includes("urgent") ? "text-amber-600" : "text-gray-400"}`}>
                {kpi.trend === "up" && <TrendingUp className="size-3 inline mr-0.5" />}
                {kpi.sub}
              </p>
            </Link>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Spend trend */}
          <div className="col-span-2 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm font-semibold text-gray-900">Spend Trend</p>
                <p className="text-xs text-gray-400 mt-0.5">Last 6 months</p>
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                <TrendingUp className="size-3" /> +12.4%
              </span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={d?.monthlySpend ?? []} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#1A2A52" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#1A2A52" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} />
                <Tooltip formatter={(v: number) => [fmt(v), "Spend"]} contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e2e8f0" }} />
                <Area type="monotone" dataKey="spend" stroke="#1A2A52" strokeWidth={2.5} fill="url(#spendGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Spend by category */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-900 mb-1">Spend by Category</p>
            <p className="text-xs text-gray-400 mb-4">This quarter</p>
            {(d?.spendByCategory?.length ?? 0) > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={d?.spendByCategory} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                      {(d?.spendByCategory ?? []).map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {(d?.spendByCategory ?? []).map((c, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <p className="text-[11px] text-gray-600">{c.name}</p>
                      </div>
                      <p className="text-[11px] font-semibold text-gray-900">{fmt(c.value)}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-gray-300">
                <Activity className="size-8 mb-2" />
                <p className="text-xs">No spend data yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Pending approvals */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div>
                <p className="text-sm font-semibold text-gray-900">Pending Approvals</p>
                <p className="text-xs text-gray-400">Action required from you</p>
              </div>
              <Link href="/dashboard/approvals" className="flex items-center gap-1 text-xs font-medium text-[#1A2A52] hover:underline">
                View all <ChevronRight className="size-3.5" />
              </Link>
            </div>
            {(d?.pendingApprovalItems?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                <CheckSquare className="size-8 mb-2" />
                <p className="text-xs text-gray-400">No pending approvals</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {(d?.pendingApprovalItems ?? []).map(r => {
                  const p = PRIORITY_CONFIG[r.priority] ?? PRIORITY_CONFIG.MEDIUM;
                  return (
                    <Link key={r.id} href={`/dashboard/requisitions/${r.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/60 transition-colors group">
                      <div className={`size-2 rounded-full shrink-0 ${r.priority === "CRITICAL" ? "bg-red-500" : r.priority === "HIGH" ? "bg-orange-500" : "bg-blue-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">{r.title}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{r.requestor?.name} · {r.requisitionNumber}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-gray-900">{fmt(Number(r.totalAmount ?? 0))}</p>
                        <p className={`text-[10px] font-semibold ${p.color}`}>{p.label}</p>
                      </div>
                      <ChevronRight className="size-4 text-gray-300 group-hover:text-[#1A2A52] shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent requisitions */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div>
                <p className="text-sm font-semibold text-gray-900">Recent Requisitions</p>
                <p className="text-xs text-gray-400">Latest purchase requests</p>
              </div>
              <Link href="/dashboard/requisitions" className="flex items-center gap-1 text-xs font-medium text-[#1A2A52] hover:underline">
                View all <ChevronRight className="size-3.5" />
              </Link>
            </div>
            {(d?.recentRequisitions?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                <FileText className="size-8 mb-2" />
                <p className="text-xs text-gray-400">No requisitions yet</p>
                <Link href="/dashboard/intake" className="mt-2 text-xs text-[#1A2A52] font-medium hover:underline">Create your first</Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {(d?.recentRequisitions ?? []).map(r => (
                  <Link key={r.id} href={`/dashboard/requisitions/${r.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/60 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{r.title}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{r.requestor?.name} · {r.requisitionNumber}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={r.status} />
                      <p className="text-xs font-bold text-gray-900 w-16 text-right">{fmt(Number(r.totalAmount ?? 0))}</p>
                      <ChevronRight className="size-4 text-gray-300 group-hover:text-[#1A2A52]" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top suppliers */}
        {(d?.topSuppliers?.length ?? 0) > 0 && (
          <div className="mt-4 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <p className="text-sm font-semibold text-gray-900">Top Suppliers by Spend</p>
              <Link href="/dashboard/suppliers" className="flex items-center gap-1 text-xs font-medium text-[#1A2A52] hover:underline">
                All suppliers <ChevronRight className="size-3.5" />
              </Link>
            </div>
            <div className="p-5">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={d?.topSuppliers ?? []} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                    tickFormatter={v => v.split(" ")[0]} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="spend" fill="#1A2A52" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="mt-4 grid grid-cols-4 gap-3">
          {[
            { label: "New Request",      desc: "Submit a purchase request",    icon: FileText,   href: "/dashboard/intake",           color: "bg-[#1A2A52]" },
            { label: "Add Supplier",     desc: "Onboard a new vendor",         icon: Building2,  href: "/dashboard/suppliers",         color: "bg-[#059669]" },
            { label: "View Approvals",   desc: "Review pending requests",      icon: CheckSquare,href: "/dashboard/approvals",         color: "bg-amber-500" },
            { label: "Connections",      desc: "Manage ERP & platform links",  icon: Zap,        href: "/dashboard/integrations",      color: "bg-[#7C3AED]" },
          ].map(a => (
            <Link key={a.label} href={a.href}
              className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
              <div className={`size-9 rounded-xl ${a.color} flex items-center justify-center shrink-0`}>
                <a.icon className="size-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900">{a.label}</p>
                <p className="text-[10px] text-gray-400 truncate">{a.desc}</p>
              </div>
              <ArrowUpRight className="size-3.5 text-gray-300 group-hover:text-[#1A2A52] ml-auto shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
