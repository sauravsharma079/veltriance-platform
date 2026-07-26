
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, XCircle, AlertCircle, Clock, RefreshCw,
  TrendingUp, TrendingDown, Wifi, WifiOff, Activity,
  ArrowLeft, ChevronRight, Info, AlertTriangle,
} from "lucide-react";

type LogEntry = {
  id: string; level: string; event: string;
  message: string; meta: Record<string, unknown> | null;
  createdAt: string;
};

type Integration = {
  key: string; name: string; category: string; id: string | null;
  status: string; lastSyncAt: string | null; lastError: string | null;
  syncCount: number; errorCount: number; logoColor: string; logoInitials: string;
  logs: LogEntry[];
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; color: string; bg: string; dot: string }> = {
  CONNECTED:    { label: "Healthy",       icon: CheckCircle2, color: "text-green-700",  bg: "bg-green-50 border-green-200",  dot: "bg-green-500"  },
  ERROR:        { label: "Error",         icon: XCircle,      color: "text-red-700",    bg: "bg-red-50 border-red-200",      dot: "bg-red-500"    },
  PAUSED:       { label: "Paused",        icon: Clock,        color: "text-amber-700",  bg: "bg-amber-50 border-amber-200",  dot: "bg-amber-500"  },
  DISCONNECTED: { label: "Disconnected",  icon: WifiOff,      color: "text-gray-500",   bg: "bg-gray-100 border-gray-200",   dot: "bg-gray-300"   },
};

const LOG_CONFIG: Record<string, { icon: typeof Info; color: string; bg: string }> = {
  INFO:    { icon: Info,          color: "text-blue-600",  bg: "bg-blue-50"  },
  SUCCESS: { icon: CheckCircle2,  color: "text-green-600", bg: "bg-green-50" },
  WARN:    { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
  ERROR:   { icon: XCircle,       color: "text-red-600",   bg: "bg-red-50"   },
};

function StatCard({ label, value, sub, color, icon: Icon }: { label: string; value: number; sub?: string; color: string; icon: typeof CheckCircle2 }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        <div className={`size-8 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="size-4 text-white" />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function HealthBar({ success, error, total }: { success: number; error: number; total: number }) {
  if (total === 0) return <div className="h-2 bg-gray-100 rounded-full" />;
  const sp = (success / total) * 100;
  const ep = (error   / total) * 100;
  return (
    <div className="h-2 bg-gray-100 rounded-full flex overflow-hidden">
      <div className="bg-green-500 h-full rounded-l-full transition-all" style={{ width: `${sp}%` }} />
      <div className="bg-red-400 h-full transition-all" style={{ width: `${ep}%` }} />
    </div>
  );
}

function LogRow({ log }: { log: LogEntry }) {
  const cfg = LOG_CONFIG[log.level] ?? LOG_CONFIG.INFO;
  const Icon = cfg.icon;
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl ${cfg.bg}`}>
      <Icon className={`size-4 shrink-0 mt-0.5 ${cfg.color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[10px] font-bold uppercase ${cfg.color}`}>{log.level}</span>
          <span className="text-[10px] font-medium text-gray-500 bg-white/60 px-1.5 py-0.5 rounded">{log.event}</span>
        </div>
        <p className="text-xs text-gray-700">{log.message}</p>
        {log.meta && Object.keys(log.meta).length > 0 && (
          <pre className="mt-1.5 text-[10px] text-gray-500 bg-white/60 rounded-lg px-2 py-1 overflow-x-auto">
            {JSON.stringify(log.meta, null, 2)}
          </pre>
        )}
      </div>
      <time className="text-[10px] text-gray-400 shrink-0">{new Date(log.createdAt).toLocaleTimeString()}</time>
    </div>
  );
}

function IntegrationRow({ integration, onClick }: { integration: Integration; onClick: () => void }) {
  const connected = integration.status === "CONNECTED";
  const errored   = integration.status === "ERROR";
  const cfg       = STATUS_CONFIG[integration.status] ?? STATUS_CONFIG.DISCONNECTED;
  const Icon      = cfg.icon;
  const health    = integration.syncCount > 0
    ? Math.round(((integration.syncCount - integration.errorCount) / integration.syncCount) * 100)
    : null;

  return (
    <div onClick={onClick}
      className={`flex items-center gap-4 px-5 py-4 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50/60 transition-colors group ${errored ? "bg-red-50/30" : ""}`}>
      {/* Logo */}
      <div className="size-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
        style={{ backgroundColor: `#${integration.logoColor}` }}>
        {integration.logoInitials}
      </div>

      {/* Name + category */}
      <div className="w-36 shrink-0">
        <p className="text-sm font-semibold text-gray-900">{integration.name}</p>
        <p className="text-[10px] text-gray-400">{integration.category}</p>
      </div>

      {/* Status */}
      <div className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border w-28 shrink-0 ${cfg.bg} ${cfg.color}`}>
        <span className={`size-1.5 rounded-full shrink-0 ${cfg.dot}`} />
        {cfg.label}
      </div>

      {/* Health bar */}
      <div className="flex-1 min-w-0">
        {connected ? (
          <div>
            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
              <span>{integration.syncCount} syncs</span>
              {health !== null && <span className={health >= 90 ? "text-green-600" : health >= 70 ? "text-amber-600" : "text-red-600"}>{health}% healthy</span>}
            </div>
            <HealthBar success={integration.syncCount - integration.errorCount} error={integration.errorCount} total={integration.syncCount} />
          </div>
        ) : integration.status === "ERROR" && integration.lastError ? (
          <p className="text-xs text-red-600 truncate">{integration.lastError}</p>
        ) : (
          <p className="text-xs text-gray-400">{integration.id ? "No sync data yet" : "Not configured"}</p>
        )}
      </div>

      {/* Error count */}
      <div className="w-20 text-right shrink-0">
        {integration.errorCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
            <XCircle className="size-3" /> {integration.errorCount}
          </span>
        )}
      </div>

      {/* Last sync */}
      <div className="w-32 text-right shrink-0">
        <p className="text-[10px] text-gray-400">
          {integration.lastSyncAt ? new Date(integration.lastSyncAt).toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }) : "—"}
        </p>
      </div>

      <ChevronRight className="size-4 text-gray-300 group-hover:text-[#1A2A52] shrink-0" />
    </div>
  );
}

function DetailPanel({ integration, onClose, onSync }: {
  integration: Integration;
  onClose: () => void;
  onSync: () => void;
}) {
  const cfg  = STATUS_CONFIG[integration.status] ?? STATUS_CONFIG.DISCONNECTED;
  const Icon = cfg.icon;
  const health = integration.syncCount > 0
    ? Math.round(((integration.syncCount - integration.errorCount) / integration.syncCount) * 100)
    : null;

  return (
    <div className="w-[420px] bg-white border-l border-gray-100 flex flex-col h-full shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
        <div className="size-10 rounded-xl flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: `#${integration.logoColor}` }}>
          {integration.logoInitials}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{integration.name}</p>
          <span className={`flex items-center gap-1 text-[10px] font-semibold w-fit mt-0.5 ${cfg.color}`}>
            <Icon className="size-3" /> {cfg.label}
          </span>
        </div>
        <button onClick={onSync} className="flex items-center gap-1.5 text-xs text-[#1A2A52] border border-[#1A2A52]/20 px-3 py-1.5 rounded-lg hover:bg-[#1A2A52]/5">
          <RefreshCw className="size-3" /> Sync now
        </button>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <XCircle className="size-5" />
        </button>
      </div>

      {/* Stats */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-gray-900">{integration.syncCount}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Total syncs</p>
          </div>
          <div className={`rounded-xl p-3 text-center ${integration.errorCount > 0 ? "bg-red-50" : "bg-gray-50"}`}>
            <p className={`text-xl font-bold ${integration.errorCount > 0 ? "text-red-600" : "text-gray-900"}`}>{integration.errorCount}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Errors</p>
          </div>
          <div className={`rounded-xl p-3 text-center ${health !== null && health >= 90 ? "bg-green-50" : health !== null && health >= 70 ? "bg-amber-50" : "bg-gray-50"}`}>
            <p className={`text-xl font-bold ${health !== null && health >= 90 ? "text-green-700" : health !== null && health >= 70 ? "text-amber-700" : "text-gray-900"}`}>
              {health !== null ? `${health}%` : "—"}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">Health</p>
          </div>
        </div>
        {integration.syncCount > 0 && (
          <HealthBar
            success={integration.syncCount - integration.errorCount}
            error={integration.errorCount}
            total={integration.syncCount}
          />
        )}
        {integration.lastError && (
          <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            <AlertCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-700 mb-0.5">Last error</p>
              <p className="text-xs text-red-600">{integration.lastError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Recent activity</p>
        {integration.logs.length === 0 ? (
          <div className="text-center py-10">
            <Activity className="size-8 text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-gray-400">No activity yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {integration.logs.map(log => <LogRow key={log.id} log={log} />)}
          </div>
        )}
      </div>

      {/* Footer */}
      {integration.lastSyncAt && (
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
          <p className="text-[10px] text-gray-400">Last sync: {new Date(integration.lastSyncAt).toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}

export default function IntegrationsDashboard() {
  const router = useRouter();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Integration | null>(null);
  const [filter, setFilter] = useState<"all" | "healthy" | "error" | "disconnected">("all");
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/integrations");
    if (res.ok) { const d = await res.json(); setIntegrations(d.integrations ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh selected when data reloads
  useEffect(() => {
    if (selected) {
      const updated = integrations.find(i => i.key === selected.key);
      if (updated) setSelected(updated);
    }
  }, [integrations]);

  const connected    = integrations.filter(i => i.status === "CONNECTED");
  const errored      = integrations.filter(i => i.status === "ERROR");
  const disconnected = integrations.filter(i => i.status === "DISCONNECTED");
  const totalErrors  = integrations.reduce((a, i) => a + (i.errorCount ?? 0), 0);
  const totalSyncs   = integrations.reduce((a, i) => a + (i.syncCount ?? 0), 0);
  const overallHealth = totalSyncs > 0 ? Math.round(((totalSyncs - totalErrors) / totalSyncs) * 100) : null;

  const filtered = integrations.filter(i => {
    if (filter === "healthy")      return i.status === "CONNECTED" && i.errorCount === 0;
    if (filter === "error")        return i.status === "ERROR" || i.errorCount > 0;
    if (filter === "disconnected") return i.status === "DISCONNECTED";
    return i.id !== null; // "all" shows only configured
  });

  async function handleSync(integration: Integration) {
    if (!integration.id) return;
    setSyncing(true);
    // Simulate a sync ping + log
    await fetch(`/api/integrations/${integration.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "CONNECTED",
        logEvent: { level: "INFO", event: "SYNC_START", message: "Manual sync triggered" },
      }),
    });
    setSyncing(false);
    load();
  }

  return (
    <div className="flex h-screen bg-[#F7F8FA] overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-100 px-8 py-5 shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => router.push("/dashboard/integrations")}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#1A2A52] transition-colors">
              <ArrowLeft className="size-3.5" /> Connections
            </button>
            <span className="text-gray-300">/</span>
            <span className="text-xs font-semibold text-gray-700">Dashboard</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Integration Health</h1>
              <p className="text-sm text-gray-400 mt-0.5">Monitor sync status, errors, and activity across all connections</p>
            </div>
            <button onClick={load} className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50">
              <RefreshCw className="size-4" /> Refresh
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="px-8 py-5 grid grid-cols-5 gap-4 shrink-0">
          <StatCard label="Connected"    value={connected.length}    sub={`of ${integrations.filter(i=>i.id).length} configured`} color="bg-green-500" icon={Wifi}         />
          <StatCard label="Errors"       value={errored.length}      sub={`${totalErrors} total error events`}                    color="bg-red-500"   icon={XCircle}      />
          <StatCard label="Disconnected" value={disconnected.filter(i=>i.id).length} sub="configured but offline"                 color="bg-gray-400"  icon={WifiOff}      />
          <StatCard label="Total syncs"  value={totalSyncs}          sub="across all connections"                                 color="bg-blue-500"  icon={RefreshCw}    />
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Overall health</p>
              <div className={`size-8 rounded-xl flex items-center justify-center ${overallHealth !== null && overallHealth >= 90 ? "bg-green-500" : overallHealth !== null && overallHealth >= 70 ? "bg-amber-500" : "bg-gray-400"}`}>
                <Activity className="size-4 text-white" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">{overallHealth !== null ? `${overallHealth}%` : "—"}</p>
            <p className="text-xs text-gray-400">
              {overallHealth !== null && overallHealth >= 90 ? "All systems healthy" : overallHealth !== null && overallHealth >= 70 ? "Some issues" : overallHealth !== null ? "Needs attention" : "No sync data"}
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="px-8 pb-3 flex items-center gap-2 shrink-0">
          {[
            { id: "all"          as const, label: "All configured",    count: integrations.filter(i=>i.id).length },
            { id: "healthy"      as const, label: "Healthy",           count: connected.filter(i=>i.errorCount===0).length },
            { id: "error"        as const, label: "With errors",       count: integrations.filter(i=>i.status==="ERROR"||i.errorCount>0).length },
            { id: "disconnected" as const, label: "Disconnected",      count: disconnected.filter(i=>i.id).length },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-colors ${filter === f.id ? "bg-[#1A2A52] text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"}`}>
              {f.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filter === f.id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>{f.count}</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="px-8 flex-1 overflow-y-auto">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
              <div className="w-9 shrink-0" />
              <div className="w-36 shrink-0"><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Integration</p></div>
              <div className="w-28 shrink-0"><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Status</p></div>
              <div className="flex-1"><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Health</p></div>
              <div className="w-20 text-right shrink-0"><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Errors</p></div>
              <div className="w-32 text-right shrink-0"><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Last sync</p></div>
              <div className="w-4 shrink-0" />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="size-6 border-2 border-[#1A2A52]/20 border-t-[#1A2A52] rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <Activity className="size-8 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No integrations in this category</p>
              </div>
            ) : (
              filtered.map(i => (
                <IntegrationRow key={i.key} integration={i}
                  onClick={() => setSelected(selected?.key === i.key ? null : i)} />
              ))
            )}
          </div>

          {/* Error details section */}
          {filter !== "error" && integrations.some(i => i.errorCount > 0 || i.status === "ERROR") && (
            <div className="mt-4 mb-8">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <AlertCircle className="size-4 text-red-500" /> Active errors
              </h2>
              <div className="space-y-2">
                {integrations.filter(i => i.errorCount > 0 || i.status === "ERROR").map(i => (
                  <div key={i.key} className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-4">
                    <div className="size-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: `#${i.logoColor}` }}>{i.logoInitials}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-red-900">{i.name}</p>
                        <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">{i.errorCount} error{i.errorCount !== 1 ? "s" : ""}</span>
                      </div>
                      {i.lastError && <p className="text-xs text-red-700">{i.lastError}</p>}
                      {i.logs.filter(l => l.level === "ERROR").slice(0, 2).map(log => (
                        <p key={log.id} className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                          <span className="text-red-400">·</span> {log.message}
                          <span className="text-red-400 ml-1">{new Date(log.createdAt).toLocaleTimeString()}</span>
                        </p>
                      ))}
                    </div>
                    <button onClick={() => setSelected(i)}
                      className="text-xs text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 shrink-0">
                      View logs
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          integration={selected}
          onClose={() => setSelected(null)}
          onSync={() => handleSync(selected)}
        />
      )}
    </div>
  );
}
