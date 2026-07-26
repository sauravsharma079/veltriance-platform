"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Trash2, Copy, RefreshCw, CheckCircle2, Shield, Zap,
  Eye, EyeOff, ToggleLeft, ToggleRight, AlertTriangle, Key,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ApiClientRecord = {
  id: string; name: string; description: string | null;
  clientId: string; scopes: string[]; active: boolean;
  lastUsedAt: string | null; createdAt: string;
  _count: { tokens: number };
};

const SCOPE_GROUPS = [
  { label: "Requisitions",    scopes: ["requisitions:read", "requisitions:write"] },
  { label: "Purchase Orders", scopes: ["purchase_orders:read", "purchase_orders:write"] },
  { label: "Suppliers",       scopes: ["suppliers:read", "suppliers:write"] },
  { label: "Lookup Values",   scopes: ["lookup_values:read"] },
  { label: "Users",           scopes: ["users:read"] },
  { label: "Administration",  scopes: ["admin:read"] },
];

const SCOPE_DESC: Record<string, string> = {
  "requisitions:read":      "Read purchase requisitions and line items",
  "requisitions:write":     "Create and update requisitions",
  "purchase_orders:read":   "Read purchase orders",
  "purchase_orders:write":  "Update PO status and fields",
  "suppliers:read":         "Read supplier directory",
  "suppliers:write":        "Create and update suppliers",
  "lookup_values:read":     "Read lookup / reference data",
  "users:read":             "Read user directory",
  "admin:read":             "Read admin configuration",
};

// ─── Credential reveal box ────────────────────────────────────────────────────

function CredentialBox({ label, value }: { label: string; value: string }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-gray-900 rounded-xl px-4 py-3">
      <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs text-green-400 font-mono break-all">
          {visible ? value : value.slice(0, 12) + "•".repeat(24)}
        </code>
        <button onClick={() => setVisible(v => !v)} className="text-gray-500 hover:text-gray-300 shrink-0">
          {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
        <button onClick={copy} className="text-gray-500 hover:text-gray-300 shrink-0">
          {copied ? <CheckCircle2 className="size-3.5 text-green-400" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ApiClientsTab() {
  const [clients, setClients] = useState<ApiClientRecord[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", scopes: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [newCredentials, setNewCredentials] = useState<{ client_id: string; client_secret: string } | null>(null);
  const [rotatedSecret, setRotatedSecret] = useState<{ id: string; secret: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/api-clients");
    const data = await res.json();
    setClients(data.clients ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleScope(scope: string) {
    setForm(f => ({
      ...f,
      scopes: f.scopes.includes(scope) ? f.scopes.filter(s => s !== scope) : [...f.scopes, scope],
    }));
  }

  async function createClient() {
    setSaving(true);
    const res = await fetch("/api/admin/api-clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setNewCredentials({ client_id: data.client_id, client_secret: data.client_secret });
      setCreating(false);
      setForm({ name: "", description: "", scopes: [] });
      load();
    } else {
      alert(data.error ?? "Failed to create client");
    }
  }

  async function toggleActive(client: ApiClientRecord) {
    await fetch(`/api/admin/api-clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !client.active }),
    });
    load();
  }

  async function rotateSecret(client: ApiClientRecord) {
    if (!confirm(`Rotate secret for "${client.name}"? All existing tokens will be revoked immediately.`)) return;
    const res = await fetch(`/api/admin/api-clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rotate_secret: true }),
    });
    const data = await res.json();
    if (res.ok) {
      setRotatedSecret({ id: client.id, secret: data.client_secret });
      load();
    }
  }

  async function deleteClient(client: ApiClientRecord) {
    if (!confirm(`Permanently delete "${client.name}"? All tokens will stop working immediately.`)) return;
    await fetch(`/api/admin/api-clients/${client.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">API Clients</h2>
          <p className="text-sm text-gray-500 mt-0.5">Create OAuth 2.0 credentials for external systems to integrate with the Veltriance API.</p>
        </div>
        <button onClick={() => setCreating(v => !v)}
          className="flex items-center gap-1.5 bg-[#1A2A52] text-white text-sm font-medium px-3.5 py-2 rounded-xl hover:bg-[#243766]">
          <Plus className="size-3.5" /> New client
        </button>
      </div>

      {/* New credentials reveal — shown once after creation */}
      {newCredentials && (
        <div className="bg-gray-950 border border-gray-700 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Key className="size-4 text-green-400" />
            <p className="text-sm font-semibold text-white">Client created — save these credentials now</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-900/30 rounded-lg px-3 py-2">
            <AlertTriangle className="size-3.5 shrink-0" />
            The client secret will not be shown again. Copy it to a secure vault before closing.
          </div>
          <CredentialBox label="Client ID"     value={newCredentials.client_id}     />
          <CredentialBox label="Client Secret" value={newCredentials.client_secret} />
          <button onClick={() => setNewCredentials(null)}
            className="text-xs text-gray-500 hover:text-gray-300">Dismiss (I've saved the credentials)</button>
        </div>
      )}

      {/* Rotated secret reveal */}
      {rotatedSecret && (
        <div className="bg-gray-950 border border-amber-700 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="size-4 text-amber-400" />
            <p className="text-sm font-semibold text-white">New secret — save it now</p>
          </div>
          <CredentialBox label="New Client Secret" value={rotatedSecret.secret} />
          <button onClick={() => setRotatedSecret(null)} className="text-xs text-gray-500 hover:text-gray-300">Dismiss</button>
        </div>
      )}

      {/* Create form */}
      {creating && (
        <div className="bg-white border border-[#C8A04D]/30 rounded-2xl p-6 shadow-sm space-y-4">
          <p className="text-sm font-semibold text-gray-900">New API client</p>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Client name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1A2A52]"
                placeholder="e.g. Coupa Integration" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1A2A52]"
                placeholder="Optional" />
            </div>
          </div>

          {/* Scope picker */}
          <div>
            <p className="text-xs font-medium text-gray-700 mb-2">Scopes (permissions) *</p>
            <div className="space-y-3">
              {SCOPE_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{group.label}</p>
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {group.scopes.map(scope => {
                      const selected = form.scopes.includes(scope);
                      return (
                        <label key={scope}
                          className={`flex items-start gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${selected ? "bg-[#1A2A52]/8 border-[#1A2A52]/30" : "bg-gray-50 border-gray-200 hover:border-gray-300"}`}>
                          <input type="checkbox" checked={selected} onChange={() => toggleScope(scope)}
                            className="mt-0.5 size-3.5 accent-[#1A2A52] shrink-0" />
                          <div className="min-w-0">
                            <p className={`text-xs font-mono font-medium ${selected ? "text-[#1A2A52]" : "text-gray-700"}`}>{scope}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{SCOPE_DESC[scope]}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={createClient} disabled={saving || !form.name || form.scopes.length === 0}
              className="bg-[#1A2A52] text-white text-sm font-medium px-5 py-2 rounded-xl disabled:opacity-50">
              {saving ? "Creating…" : "Create client"}
            </button>
            <button onClick={() => setCreating(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
          </div>
        </div>
      )}

      {/* Client list */}
      {clients.length === 0 && !creating ? (
        <div className="bg-white border border-gray-100 rounded-2xl px-6 py-14 text-center shadow-sm">
          <Zap className="size-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">No API clients yet</p>
          <p className="text-xs text-gray-400">Create a client to let external systems connect to Veltriance.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map(client => (
            <div key={client.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4">
                {/* Status dot */}
                <div className={`size-2.5 rounded-full shrink-0 ${client.active ? "bg-green-500" : "bg-gray-300"}`} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{client.name}</p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${client.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {client.active ? "Active" : "Inactive"}
                    </span>
                    <span className="text-[10px] text-gray-400">{client.scopes.length} scope{client.scopes.length !== 1 ? "s" : ""}</span>
                    <span className="text-[10px] text-gray-400">·  {client._count.tokens} token{client._count.tokens !== 1 ? "s" : ""} issued</span>
                  </div>
                  <code className="text-[10px] text-gray-400 font-mono mt-0.5 block truncate">{client.clientId}</code>
                  {client.description && <p className="text-xs text-gray-400 mt-0.5">{client.description}</p>}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setExpandedId(expandedId === client.id ? null : client.id)}
                    className="text-xs text-[#1A2A52] border border-[#1A2A52]/20 px-2.5 py-1.5 rounded-lg hover:bg-[#1A2A52]/5">
                    {expandedId === client.id ? "Collapse" : "Details"}
                  </button>
                  <button onClick={() => toggleActive(client)} title={client.active ? "Deactivate" : "Activate"}
                    className="text-gray-400 hover:text-[#1A2A52]">
                    {client.active ? <ToggleRight className="size-5 text-green-500" /> : <ToggleLeft className="size-5" />}
                  </button>
                  <button onClick={() => rotateSecret(client)} title="Rotate secret"
                    className="text-gray-400 hover:text-amber-600 transition-colors">
                    <RefreshCw className="size-4" />
                  </button>
                  <button onClick={() => deleteClient(client)} title="Delete"
                    className="text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {expandedId === client.id && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/40">
                  {/* Scopes */}
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Granted scopes</p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {client.scopes.map(s => (
                      <span key={s} className="flex items-center gap-1 text-[10px] font-mono bg-[#1A2A52]/8 text-[#1A2A52] px-2 py-1 rounded-full">
                        <Shield className="size-2.5" /> {s}
                      </span>
                    ))}
                  </div>

                  {/* Usage snippet */}
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Usage</p>
                  <div className="bg-gray-900 rounded-xl p-4 space-y-3">
                    <div>
                      <p className="text-[10px] text-gray-500 mb-1">1. Get access token</p>
                      <code className="text-[10px] text-green-400 font-mono whitespace-pre-wrap block">
{`curl -X POST https://yourworkspace.veltriance.com/api/oauth2/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=client_credentials&client_id=${client.clientId}&client_secret=<SECRET>&scope=${client.scopes.slice(0,2).join(' ')}"`}
                      </code>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 mb-1">2. Call the API</p>
                      <code className="text-[10px] text-green-400 font-mono whitespace-pre-wrap block">
{`curl https://yourworkspace.veltriance.com/api/v1/requisitions \\
  -H "Authorization: Bearer <access_token>"`}
                      </code>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-400">
                    <span>Created: {new Date(client.createdAt).toLocaleDateString()}</span>
                    {client.lastUsedAt && <span>Last used: {new Date(client.lastUsedAt).toLocaleDateString()}</span>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
