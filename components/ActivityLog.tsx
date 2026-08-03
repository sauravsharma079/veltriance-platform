"use client";

import { useEffect, useState } from "react";
import { Clock, Plus, Pencil, Trash2, Send, CheckCircle2, XCircle, Upload } from "lucide-react";

// Matches the shape getAuditLogs() / GET /api/audit actually return (see
// lib/audit.ts) — same shape the standalone /dashboard/history page already
// consumes, so this stays a drop-in for either.
type LogRow = {
  id: string; event: string; createdAt: string;
  request: {
    userName?: string; entity?: string; entityId?: string; entityLabel?: string;
    action?: string; details?: Record<string, unknown>;
  };
};

const ACTION_ICON: Record<string, typeof Clock> = {
  CREATED: Plus, UPDATED: Pencil, DELETED: Trash2, SENT: Send,
  APPROVED: CheckCircle2, REJECTED: XCircle, UPLOADED: Upload,
  SUBMITTED: Send, CANCELLED: XCircle,
};

const ACTION_COLOR: Record<string, string> = {
  CREATED: "text-emerald-600 bg-emerald-50", UPDATED: "text-blue-600 bg-blue-50",
  DELETED: "text-red-600 bg-red-50", SENT: "text-[#1A2A52] bg-[#1A2A52]/8",
  APPROVED: "text-emerald-600 bg-emerald-50", REJECTED: "text-red-600 bg-red-50",
  UPLOADED: "text-amber-600 bg-amber-50", SUBMITTED: "text-blue-600 bg-blue-50",
  CANCELLED: "text-gray-500 bg-gray-100",
};

function describe(row: LogRow): string {
  const req = row.request || {};
  const action = req.action || row.event?.split(".")?.[1] || "";
  const entity = req.entity || row.event?.split(".")?.[0] || "";
  const who = req.userName ?? "Someone";
  const what = req.entityLabel ? ` "${req.entityLabel}"` : "";
  switch (action) {
    case "CREATED": return `${who} created${what}`;
    case "UPDATED": {
      const fields = (req.details?.fields as string[] | undefined) ?? (req.details?.changeOrder ? ["change order"] : undefined);
      return `${who} updated${what}${fields?.length ? ` (${fields.join(", ")})` : ""}`;
    }
    case "DELETED": return `${who} deleted${what}`;
    case "SENT": {
      const method = req.details?.method as string | undefined;
      return `${who} sent${what}${method ? ` via ${method}` : ""}${req.details?.isChangeOrder ? ` (change order #${req.details?.changeOrderNumber})` : ""}`;
    }
    case "APPROVED": return `${who} approved${what}${req.details?.step ? ` at ${req.details.step} step` : ""}`;
    case "REJECTED": return `${who} rejected${what}`;
    case "UPLOADED": return `${who} bulk-uploaded ${req.details?.total ?? ""} row(s) to ${entity.toLowerCase()}`;
    case "SUBMITTED": return `${who} submitted${what}`;
    case "CANCELLED": return `${who} cancelled${what}`;
    default: return `${who} ${action.toLowerCase()}${what}`;
  }
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Drop-in activity/history panel scoped to one record — pass `entity` +
 * `entityId` for a requisition/supplier/PO's own history. For the org-wide
 * feed across every module, link to /dashboard/history instead (it already
 * has search, stats, and expandable raw detail — no need to duplicate it here).
 */
export function ActivityLog({ entity, entityId, limit = 20, title = "Activity" }: { entity?: string; entityId?: string; limit?: number; title?: string }) {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (entity) params.set("entity", entity);
    if (entityId) params.set("entityId", entityId);
    params.set("limit", String(limit));
    fetch(`/api/audit?${params.toString()}`)
      .then(r => r.json())
      .then(d => setLogs(d.logs ?? []))
      .finally(() => setLoading(false));
  }, [entity, entityId, limit]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <Clock className="size-3.5 text-gray-400" />
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
      </div>
      {loading ? (
        <p className="text-xs text-gray-400 px-4 py-4">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-xs text-gray-400 px-4 py-4">No activity recorded yet.</p>
      ) : (
        <ul className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
          {logs.map(row => {
            const action = row.request?.action || row.event?.split(".")?.[1] || "";
            const Icon = ACTION_ICON[action] ?? Clock;
            const color = ACTION_COLOR[action] ?? "text-gray-500 bg-gray-100";
            return (
              <li key={row.id} className="px-4 py-2.5 flex items-start gap-2.5">
                <div className={`size-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${color}`}>
                  <Icon className="size-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700">{describe(row)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(row.createdAt)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
