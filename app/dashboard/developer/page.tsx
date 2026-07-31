
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Key, Code2, Zap, Shield, Copy, CheckCircle2, Plus, Trash2,
  RefreshCw, Eye, EyeOff, ToggleLeft, ToggleRight, AlertTriangle,
  ChevronDown, ChevronRight, Lock,
} from "lucide-react";

type ApiClientRecord = {
  id: string; name: string; description: string | null;
  clientId: string; scopes: string[]; active: boolean;
  lastUsedAt: string | null; createdAt: string;
  _count: { tokens: number };
};

const SCOPE_GROUPS = [
  { label: "Purchase Requests", scopes: ["requisitions:read", "requisitions:write"] },
  { label: "Purchase Orders",   scopes: ["purchase_orders:read", "purchase_orders:write"] },
  { label: "Suppliers",         scopes: ["suppliers:read", "suppliers:write"] },
  { label: "Lookup Values",     scopes: ["lookup_values:read"] },
  { label: "Users",             scopes: ["users:read"] },
  { label: "Administration",    scopes: ["admin:read"] },
];

const SCOPE_DESC: Record<string, string> = {
  "requisitions:read":     "List and read purchase requisitions",
  "requisitions:write":    "Create and update requisitions",
  "purchase_orders:read":  "List and read purchase orders",
  "purchase_orders:write": "Update purchase order status and fields",
  "suppliers:read":        "List and read supplier records",
  "suppliers:write":       "Create and update suppliers",
  "lookup_values:read":    "Read reference / lookup data",
  "users:read":            "Read user directory",
  "admin:read":            "Read admin configuration",
};

const API_ENDPOINTS = [
  {
    method: "POST", path: "/api/oauth2/token", auth: false,
    description: "Get an access token using client credentials grant",
    body: `grant_type=client_credentials\n&client_id=vlt_client_xxx\n&client_secret=vlt_secret_xxx\n&scope=requisitions:read suppliers:read`,
    response: `{\n  "access_token": "vlt_abc123...",\n  "token_type": "Bearer",\n  "expires_in": 3600,\n  "scope": "requisitions:read suppliers:read"\n}`,
  },
  {
    method: "GET", path: "/api/v1/requisitions", auth: true, scope: "requisitions:read",
    description: "List all purchase requisitions with optional filters",
    params: ["status", "priority", "category", "offset", "limit"],
    response: `{\n  "data": [{ "id": "...", "requisitionNumber": "REQ-000001", "status": "APPROVED" }],\n  "pagination": { "total": 42, "offset": 0, "limit": 50 }\n}`,
  },
  {
    method: "GET", path: "/api/v1/requisitions/:id", auth: true, scope: "requisitions:read",
    description: "Get a single requisition with line items and approval steps",
    response: `{ "data": { "id": "...", "lineItems": [...], "approvalSteps": [...] } }`,
  },
  {
    method: "POST", path: "/api/v1/requisitions", auth: true, scope: "requisitions:write",
    description: "Create a new draft requisition",
    body: `{\n  "title": "Laptop for new hire",\n  "requestor_id": "user-uuid",\n  "priority": "HIGH",\n  "category": "IT Hardware"\n}`,
    response: `{ "data": { "id": "...", "requisitionNumber": "REQ-000042", "status": "DRAFT" } }`,
  },
  {
    method: "PATCH", path: "/api/v1/requisitions/:id", auth: true, scope: "requisitions:write",
    description: "Submit or cancel a requisition",
    body: `{ "status": "SUBMITTED" }`,
    response: `{ "data": { "id": "...", "status": "SUBMITTED" } }`,
  },
  {
    method: "GET", path: "/api/v1/purchase-orders", auth: true, scope: "purchase_orders:read",
    description: "List all purchase orders",
    params: ["status", "supplier_id", "offset", "limit"],
    response: `{ "data": [...], "pagination": { "total": 12, "offset": 0, "limit": 50 } }`,
  },
  {
    method: "GET", path: "/api/v1/purchase-orders/:id", auth: true, scope: "purchase_orders:read",
    description: "Get a single purchase order with line items",
    response: `{ "data": { "id": "...", "poNumber": "PO-000001", "status": "SENT", "lineItems": [...] } }`,
  },
  {
    method: "PATCH", path: "/api/v1/purchase-orders/:id", auth: true, scope: "purchase_orders:write",
    description: "Update PO status — validates allowed transitions",
    body: `{ "status": "ACKNOWLEDGED" }`,
    response: `{ "data": { "id": "...", "status": "ACKNOWLEDGED" } }`,
  },
  {
    method: "GET", path: "/api/v1/suppliers", auth: true, scope: "suppliers:read",
    description: "List suppliers with optional search and filters",
    params: ["status", "category", "q", "offset", "limit"],
    response: `{ "data": [...], "pagination": { "total": 88 } }`,
  },
  {
    method: "POST", path: "/api/v1/suppliers", auth: true, scope: "suppliers:write",
    description: "Create a new supplier (status: PENDING_APPROVAL)",
    body: `{\n  "name": "Acme Corp",\n  "contact_email": "procurement@acme.com",\n  "category": "IT Hardware"\n}`,
    response: `{ "data": { "id": "...", "name": "Acme Corp", "status": "PENDING_APPROVAL" } }`,
  },
  {
    method: "GET", path: "/api/v1/lookup-values", auth: true, scope: "lookup_values:read",
    description: "Get reference data — cost centers, GL accounts, categories, etc.",
    params: ["type", "active", "offset", "limit"],
    response: `{ "data": [{ "type": "COST_CENTER", "code": "CC001", "label": "Engineering" }] }`,
  },
];

const METHOD_COLOR: Record<string, string> = {
  GET: "bg-blue-100 text-blue-700", POST: "bg-green-100 text-green-700",
  PATCH: "bg-amber-100 text-amber-700", DELETE: "bg-red-100 text-red-700",
};

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-gray-500 hover:text-gray-300 transition-colors shrink-0">
      {copied ? <CheckCircle2 className="size-4 text-green-400" /> : <Copy className="size-4" />}
    </button>
  );
}

function CredBox({ label, value }: { label: string; value: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl px-4 py-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs text-green-400 font-mono break-all">
          {show ? value : value.slice(0, 14) + "•".repeat(20)}
        </code>
        <button onClick={() => setShow(v => !v)} className="text-gray-500 hover:text-gray-300 shrink-0">
          {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
        <CopyBtn text={value} />
      </div>
    </div>
  );
}

function QuickStart() {
  const steps = [
    { num: "01", title: "Create an API client", desc: "Go to the API Clients tab → New client → pick a name and select scopes.", code: null },
    { num: "02", title: "Get an access token", desc: "POST to the token endpoint with your credentials.", code: `curl -X POST http://localhost:3000/api/oauth2/token \\\n  -H "Content-Type: application/x-www-form-urlencoded" \\\n  -d "grant_type=client_credentials" \\\n  -d "client_id=vlt_client_YOUR_ID" \\\n  -d "client_secret=vlt_secret_YOUR_SECRET" \\\n  -d "scope=requisitions:read"` },
    { num: "03", title: "Call the API", desc: "Pass the access token as a Bearer header.", code: `curl http://localhost:3000/api/v1/requisitions \\\n  -H "Authorization: Bearer vlt_YOUR_TOKEN"` },
    { num: "04", title: "Handle the response", desc: "All list endpoints return data + pagination.", code: `{\n  "data": [{ "id": "...", "title": "...", "status": "APPROVED" }],\n  "pagination": { "total": 42, "offset": 0, "limit": 50 }\n}` },
  ];
  return (
    <div className="space-y-4">
      {steps.map(s => (
        <div key={s.num} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="size-9 rounded-xl bg-[#1A2A52] flex items-center justify-center text-[#C8A04D] text-sm font-bold shrink-0">{s.num}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 mb-1">{s.title}</p>
              <p className="text-xs text-gray-500 mb-3">{s.desc}</p>
              {s.code && (
                <div className="relative">
                  <pre className="bg-gray-900 text-green-400 text-[11px] font-mono rounded-xl px-4 py-3 overflow-x-auto whitespace-pre-wrap">{s.code}</pre>
                  <div className="absolute top-2.5 right-2.5"><CopyBtn text={s.code} /></div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ApiReference() {
  const [expanded, setExpanded] = useState<number | null>(0);
  return (
    <div className="space-y-2">
      <div className="bg-[#1A2A52] rounded-2xl px-5 py-4 mb-4">
        <p className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-1">Base URL</p>
        <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2.5">
          <code className="text-sm font-mono text-[#C8A04D] flex-1">http://localhost:3000</code>
          <CopyBtn text="http://localhost:3000" />
        </div>
      </div>
      {API_ENDPOINTS.map((ep, i) => (
        <div key={i} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          <button onClick={() => setExpanded(expanded === i ? null : i)}
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors">
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg font-mono shrink-0 ${METHOD_COLOR[ep.method]}`}>{ep.method}</span>
            <code className="text-sm font-mono text-gray-800 flex-1">{ep.path}</code>
            {ep.auth && (
              <span className="flex items-center gap-1 text-[10px] text-gray-400 shrink-0">
                <Lock className="size-3" /> {(ep as {scope?: string}).scope}
              </span>
            )}
            {expanded === i ? <ChevronDown className="size-4 text-gray-400 shrink-0" /> : <ChevronRight className="size-4 text-gray-400 shrink-0" />}
          </button>
          {expanded === i && (
            <div className="border-t border-gray-100 px-5 py-4 space-y-3 bg-gray-50/40">
              <p className="text-sm text-gray-700">{ep.description}</p>
              {(ep as {params?: string[]}).params && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Query parameters</p>
                  <div className="flex flex-wrap gap-2">
                    {(ep as {params?: string[]}).params!.map(p => <code key={p} className="text-[11px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-mono">{p}</code>)}
                  </div>
                </div>
              )}
              {(ep as {body?: string}).body && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-semibold text-gray-500">Request body</p>
                    <CopyBtn text={(ep as {body?: string}).body!} />
                  </div>
                  <pre className="bg-gray-900 text-green-400 text-xs font-mono rounded-xl px-4 py-3 overflow-x-auto whitespace-pre-wrap">{(ep as {body?: string}).body}</pre>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-gray-500">Response</p>
                  <CopyBtn text={ep.response} />
                </div>
                <pre className="bg-gray-900 text-blue-300 text-xs font-mono rounded-xl px-4 py-3 overflow-x-auto whitespace-pre-wrap">{ep.response}</pre>
              </div>
              {ep.auth && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  <Shield className="size-3.5 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-700">Requires Bearer token with scope: <code className="font-mono">{(ep as {scope?: string}).scope}</code></p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ApiClients() {
  const [clients, setClients] = useState<ApiClientRecord[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", scopes: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [newCreds, setNewCreds] = useState<{ client_id: string; client_secret: string } | null>(null);
  const [rotated, setRotated] = useState<{ id: string; secret: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/api-clients");
    if (res.ok) { const d = await res.json(); setClients(d.clients ?? []); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleScope(s: string) {
    setForm(f => ({ ...f, scopes: f.scopes.includes(s) ? f.scopes.filter(x => x !== s) : [...f.scopes, s] }));
  }

  async function create() {
    if (!form.name || !form.scopes.length) return;
    setSaving(true);
    const res = await fetch("/api/admin/api-clients", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    setSaving(false);
    if (res.ok) { setNewCreds({ client_id: d.client_id, client_secret: d.client_secret }); setCreating(false); setForm({ name: "", description: "", scopes: [] }); load(); }
    else alert(d.error ?? "Failed");
  }

  async function toggleActive(c: ApiClientRecord) {
    await fetch(`/api/admin/api-clients/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !c.active }) });
    load();
  }

  async function rotate(c: ApiClientRecord) {
    if (!confirm(`Rotate secret for "${c.name}"? All existing tokens will be revoked.`)) return;
    const res = await fetch(`/api/admin/api-clients/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rotate_secret: true }) });
    const d = await res.json();
    if (res.ok) { setRotated({ id: c.id, secret: d.client_secret }); load(); }
  }

  async function del(c: ApiClientRecord) {
    if (!confirm(`Delete "${c.name}"?`)) return;
    await fetch(`/api/admin/api-clients/${c.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">OAuth 2.0 API Clients</h3>
          <p className="text-xs text-gray-500 mt-0.5">Create credentials for external systems to authenticate with the Veltriance API.</p>
        </div>
        <button onClick={() => setCreating(v => !v)} className="flex items-center gap-1.5 bg-[#1A2A52] text-white text-sm font-medium px-3.5 py-2 rounded-xl hover:bg-[#243766]">
          <Plus className="size-3.5" /> New client
        </button>
      </div>

      {newCreds && (
        <div className="bg-gray-950 border border-gray-700 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2"><Key className="size-4 text-green-400" /><p className="text-sm font-semibold text-white">Client created — save these now</p></div>
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-900/30 rounded-xl px-3 py-2">
            <AlertTriangle className="size-3.5 shrink-0" /> The client secret will NOT be shown again.
          </div>
          <CredBox label="Client ID"     value={newCreds.client_id}     />
          <CredBox label="Client Secret" value={newCreds.client_secret} />
          <button onClick={() => setNewCreds(null)} className="text-xs text-gray-500 hover:text-gray-300">Dismiss (I have saved the credentials)</button>
        </div>
      )}

      {rotated && (
        <div className="bg-gray-950 border border-amber-700 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2"><RefreshCw className="size-4 text-amber-400" /><p className="text-sm font-semibold text-white">New secret — save it now</p></div>
          <CredBox label="New Client Secret" value={rotated.secret} />
          <button onClick={() => setRotated(null)} className="text-xs text-gray-500 hover:text-gray-300">Dismiss</button>
        </div>
      )}

      {creating && (
        <div className="bg-white border border-[#C8A04D]/30 rounded-2xl p-6 shadow-sm space-y-4">
          <p className="text-sm font-semibold text-gray-900">New API client</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Client name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1A2A52]"
                placeholder="e.g. SAP Ariba Integration" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1A2A52]" placeholder="Optional" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-700 mb-2">Scopes *</p>
            <div className="space-y-3">
              {SCOPE_GROUPS.map(g => (
                <div key={g.label}>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{g.label}</p>
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {g.scopes.map(s => {
                      const sel = form.scopes.includes(s);
                      return (
                        <label key={s} className={`flex items-start gap-2.5 px-3 py-2 rounded-xl border cursor-pointer ${sel ? "bg-[#1A2A52]/8 border-[#1A2A52]/30" : "bg-gray-50 border-gray-200"}`}>
                          <input type="checkbox" checked={sel} onChange={() => toggleScope(s)} className="mt-0.5 size-3.5 accent-[#1A2A52] shrink-0" />
                          <div>
                            <p className={`text-xs font-mono font-medium ${sel ? "text-[#1A2A52]" : "text-gray-700"}`}>{s}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{SCOPE_DESC[s]}</p>
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
            <button onClick={create} disabled={saving || !form.name || !form.scopes.length}
              className="bg-[#1A2A52] text-white text-sm font-medium px-5 py-2 rounded-xl disabled:opacity-50">
              {saving ? "Creating…" : "Create client"}
            </button>
            <button onClick={() => setCreating(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
          </div>
        </div>
      )}

      {clients.length === 0 && !creating ? (
        <div className="bg-white border border-gray-100 rounded-2xl px-6 py-12 text-center">
          <Zap className="size-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">No API clients yet</p>
          <p className="text-xs text-gray-400">Create a client to let external systems connect to Veltriance.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map(c => (
            <div key={c.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4">
                <div className={`size-2.5 rounded-full shrink-0 ${c.active ? "bg-green-500" : "bg-gray-300"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${c.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>{c.active ? "Active" : "Inactive"}</span>
                    <span className="text-[10px] text-gray-400">{c.scopes.length} scopes · {c._count.tokens} tokens issued</span>
                  </div>
                  <code className="text-[10px] text-gray-400 font-mono mt-0.5 block">{c.clientId}</code>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    className="text-xs text-[#1A2A52] border border-[#1A2A52]/20 px-2.5 py-1.5 rounded-lg hover:bg-[#1A2A52]/5">
                    {expandedId === c.id ? "Collapse" : "Details"}
                  </button>
                  <button onClick={() => toggleActive(c)}>{c.active ? <ToggleRight className="size-5 text-green-500" /> : <ToggleLeft className="size-5 text-gray-400" />}</button>
                  <button onClick={() => rotate(c)} className="text-gray-400 hover:text-amber-600"><RefreshCw className="size-4" /></button>
                  <button onClick={() => del(c)} className="text-gray-300 hover:text-red-500"><Trash2 className="size-4" /></button>
                </div>
              </div>
              {expandedId === c.id && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/40 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {c.scopes.map(s => (
                      <span key={s} className="flex items-center gap-1 text-[10px] font-mono bg-[#1A2A52]/8 text-[#1A2A52] px-2 py-1 rounded-full">
                        <Shield className="size-2.5" /> {s}
                      </span>
                    ))}
                  </div>
                  <div className="bg-gray-900 rounded-xl p-4 space-y-2">
                    <p className="text-[10px] text-gray-500">Get token</p>
                    <div className="flex items-start gap-2">
                      <pre className="text-[10px] text-green-400 font-mono flex-1 whitespace-pre-wrap">{`curl -X POST /api/oauth2/token \\\n  -d "grant_type=client_credentials" \\\n  -d "client_id=${c.clientId}" \\\n  -d "client_secret=<SECRET>" \\\n  -d "scope=${c.scopes.slice(0,2).join(" ")}"`}</pre>
                      <CopyBtn text={`curl -X POST /api/oauth2/token -d "grant_type=client_credentials&client_id=${c.clientId}&client_secret=SECRET&scope=${c.scopes.join(" ")}"`} />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2">Call API</p>
                    <pre className="text-[10px] text-blue-300 font-mono">{`curl /api/v1/requisitions \\\n  -H "Authorization: Bearer <access_token>"`}</pre>
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

type Tab = "quickstart" | "clients" | "reference";

export default function DeveloperPage() {
  const [tab, setTab] = useState<Tab>("quickstart");
  const tabs: { id: Tab; label: string; icon: typeof Code2 }[] = [
    { id: "quickstart", label: "Quick start",   icon: Zap   },
    { id: "clients",    label: "API clients",   icon: Key   },
    { id: "reference",  label: "API reference", icon: Code2 },
  ];
  return (
    <div className="flex h-screen bg-[#F7F8FA] overflow-hidden">
      <aside className="w-56 bg-white border-r border-gray-100 shrink-0 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-gradient-to-br from-[#1A2A52] to-[#2D4A8A] flex items-center justify-center">
              <Code2 className="size-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Developer</p>
              <p className="text-[10px] text-gray-400">OAuth2 · REST API</p>
            </div>
          </div>
        </div>
        <nav className="p-3 space-y-0.5 flex-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${tab === t.id ? "bg-[#1A2A52]" : "hover:bg-gray-50"}`}>
              <t.icon className={`size-4 shrink-0 ${tab === t.id ? "text-white" : "text-gray-400"}`} />
              <span className={`text-xs font-semibold ${tab === t.id ? "text-white" : "text-gray-700"}`}>{t.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl">
          {tab === "quickstart" && (<><div className="flex items-center justify-between mb-6">
          <a href="/api/developer/postman" download className="flex items-center gap-2 text-xs font-semibold text-[#1A2A52] border border-[#1A2A52]/20 px-4 py-2 rounded-xl hover:bg-[#1A2A52]/5">
            <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
            Download Postman Collection
          </a>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Quick start</h1><p className="text-sm text-gray-500 mb-6">Get your first API call working in under 5 minutes.</p><QuickStart /></>)}
          {tab === "clients"    && (<><div className="flex items-center justify-between mb-6">
          <a href="/api/developer/postman" download className="flex items-center gap-2 text-xs font-semibold text-[#1A2A52] border border-[#1A2A52]/20 px-4 py-2 rounded-xl hover:bg-[#1A2A52]/5">
            <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
            Download Postman Collection
          </a>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-1">API clients</h1><p className="text-sm text-gray-500 mb-6">Manage OAuth 2.0 credentials for external systems.</p><ApiClients /></>)}
          {tab === "reference"  && (<><div className="flex items-center justify-between mb-6">
          <a href="/api/developer/postman" download className="flex items-center gap-2 text-xs font-semibold text-[#1A2A52] border border-[#1A2A52]/20 px-4 py-2 rounded-xl hover:bg-[#1A2A52]/5">
            <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
            Download Postman Collection
          </a>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-1">API reference</h1><p className="text-sm text-gray-500 mb-6">All available endpoints with parameters and example responses.</p><ApiReference /></>)}
        </div>
      </main>
    </div>
  );
}
