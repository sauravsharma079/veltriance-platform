"use client";
import { useState, useEffect, useCallback } from "react";
import { Activity, Search, RefreshCw, Filter, User, FileText, Building2, CheckSquare, Package, Key, Upload, Settings } from "lucide-react";

type Log = {
  id: string;
  event: string;
  status: string;
  createdAt: string;
  request: {
    userId?: string; userName?: string; entity?: string;
    entityId?: string; entityLabel?: string; action?: string;
    details?: Record<string,any>; ipAddress?: string; timestamp?: string;
  };
};

const ENTITY_ICONS: Record<string, any> = {
  REQUISITION: FileText, PURCHASE_ORDER: Package, SUPPLIER: Building2,
  USER: User, LOOKUP: Settings, APPROVAL_RULE: CheckSquare,
  CATALOG: Settings, API_CLIENT: Key, CUSTOM_FIELD: Settings, INTEGRATION: Activity,
};

const ACTION_COLORS: Record<string, string> = {
  CREATED:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  UPDATED:   "bg-blue-50 text-blue-700 border-blue-200",
  DELETED:   "bg-red-50 text-red-700 border-red-200",
  SUBMITTED: "bg-purple-50 text-purple-700 border-purple-200",
  APPROVED:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED:  "bg-red-50 text-red-700 border-red-200",
  SENT:      "bg-indigo-50 text-indigo-700 border-indigo-200",
  CANCELLED: "bg-gray-100 text-gray-600 border-gray-200",
  UPLOADED:  "bg-amber-50 text-amber-700 border-amber-200",
  LOGIN:     "bg-slate-50 text-slate-700 border-slate-200",
  VIEWED:    "bg-gray-50 text-gray-600 border-gray-200",
};

const ENTITIES = ["All","REQUISITION","PURCHASE_ORDER","SUPPLIER","USER","LOOKUP","APPROVAL_RULE","CATALOG","API_CLIENT"];
const ACTIONS  = ["All","CREATED","UPDATED","DELETED","SUBMITTED","APPROVED","REJECTED","SENT","UPLOADED","CANCELLED"];

function timeAgo(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60)    return `${Math.round(diff)}s ago`;
  if (diff < 3600)  return `${Math.round(diff/60)}m ago`;
  if (diff < 86400) return `${Math.round(diff/3600)}h ago`;
  return new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState("All");
  const [action, setAction] = useState("All");
  const [expanded, setExpanded] = useState<string|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "500" });
      if (entity !== "All") params.set("entity", entity);
      if (action !== "All") params.set("action", action);
      const r = await fetch("/api/audit?" + params);
      const d = await r.json();
      setLogs(Array.isArray(d.logs) ? d.logs : []);
    } catch { setLogs([]); }
    setLoading(false);
  }, [entity, action]);

  useEffect(() => { load(); }, [load]);

  const filtered = logs.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.event?.toLowerCase().includes(q) ||
      l.request?.userName?.toLowerCase().includes(q) ||
      l.request?.entityLabel?.toLowerCase().includes(q) ||
      l.request?.action?.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: logs.length,
    today: logs.filter(l => new Date(l.createdAt) > new Date(Date.now()-86400000)).length,
    created: logs.filter(l => l.request?.action === "CREATED").length,
    approved: logs.filter(l => l.request?.action === "APPROVED").length,
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Activity History</h1>
          <p className="text-xs text-gray-400 mt-0.5">Complete audit trail of all platform actions</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50">
          <RefreshCw className="size-3"/>Refresh
        </button>
      </div>

      <div className="px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label:"Total Events", value:stats.total, color:"bg-[#1A2A52]", icon:Activity },
            { label:"Today", value:stats.today, color:"bg-purple-600", icon:Activity },
            { label:"Records Created", value:stats.created, color:"bg-emerald-600", icon:FileText },
            { label:"Approvals", value:stats.approved, color:"bg-amber-500", icon:CheckSquare },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-3">
              <div className={`size-10 ${s.color} rounded-xl flex items-center justify-center`}><s.icon className="size-5 text-white"/></div>
              <div><p className="text-2xl font-bold text-gray-900">{s.value}</p><p className="text-[10px] text-gray-400">{s.label}</p></div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by user, entity, action..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-[#1A2A52]"/>
          </div>
          <select value={entity} onChange={e=>setEntity(e.target.value)} className="text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#1A2A52]">
            {ENTITIES.map(e=><option key={e}>{e}</option>)}
          </select>
          <select value={action} onChange={e=>setAction(e.target.value)} className="text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#1A2A52]">
            {ACTIONS.map(a=><option key={a}>{a}</option>)}
          </select>
        </div>

        {/* Log Table */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-gray-50 border-b text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
            <div className="col-span-2">When</div>
            <div className="col-span-2">User</div>
            <div className="col-span-2">Action</div>
            <div className="col-span-3">Entity</div>
            <div className="col-span-2">Details</div>
            <div className="col-span-1">IP</div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16"><div className="size-8 border-2 border-[#1A2A52]/20 border-t-[#1A2A52] rounded-full animate-spin"/></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Activity className="size-10 text-gray-200 mx-auto mb-3"/>
              <p className="text-sm text-gray-400">No activity logs yet</p>
              <p className="text-xs text-gray-300 mt-1">Logs appear as users interact with the platform</p>
            </div>
          ) : (
            filtered.map(log => {
              const req  = log.request || {};
              const act  = req.action || log.event?.split(".")?.[1] || "ACTION";
              const ent  = req.entity || log.event?.split(".")?.[0] || "SYSTEM";
              const Icon = ENTITY_ICONS[ent] || Activity;
              const acColor = ACTION_COLORS[act] || "bg-gray-100 text-gray-600 border-gray-200";
              return (
                <div key={log.id}>
                  <div
                    onClick={() => setExpanded(expanded===log.id ? null : log.id)}
                    className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-gray-50 last:border-0 items-center hover:bg-gray-50/60 cursor-pointer transition-colors">
                    <div className="col-span-2">
                      <p className="text-[10px] text-gray-600">{timeAgo(log.createdAt)}</p>
                      <p className="text-[9px] text-gray-300">{new Date(log.createdAt).toLocaleTimeString("en-IN", {hour:"2-digit",minute:"2-digit"})}</p>
                    </div>
                    <div className="col-span-2 flex items-center gap-1.5">
                      <div className="size-6 bg-[#1A2A52]/10 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-[#1A2A52]">{(req.userName||"S").charAt(0)}</span>
                      </div>
                      <p className="text-[10px] font-medium text-gray-700 truncate">{req.userName||"System"}</p>
                    </div>
                    <div className="col-span-2">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${acColor}`}>{act}</span>
                    </div>
                    <div className="col-span-3 flex items-center gap-1.5">
                      <Icon className="size-3.5 text-gray-400 shrink-0"/>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-gray-700 truncate">{req.entityLabel||ent}</p>
                        <p className="text-[9px] text-gray-400">{ent}</p>
                      </div>
                    </div>
                    <div className="col-span-2">
                      {req.details && Object.keys(req.details).length > 0 ? (
                        <p className="text-[9px] text-gray-400 truncate">{Object.entries(req.details).slice(0,2).map(([k,v])=>`${k}: ${v}`).join(", ")}</p>
                      ) : <span className="text-gray-200 text-[9px]">—</span>}
                    </div>
                    <div className="col-span-1">
                      <p className="text-[9px] text-gray-300 truncate">{req.ipAddress||"—"}</p>
                    </div>
                  </div>
                  {expanded===log.id && (
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                      <pre className="text-[10px] text-gray-600 overflow-auto max-h-40 bg-white rounded-lg p-3 border border-gray-100">
                        {JSON.stringify(req, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        {!loading && filtered.length > 0 && (
          <p className="text-xs text-gray-400 mt-3 text-center">{filtered.length} events shown</p>
        )}
      </div>
    </div>
  );
}
