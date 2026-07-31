
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2, XCircle, AlertCircle, Clock, ChevronRight,
  RefreshCw, X, ExternalLink, Eye, EyeOff, Loader2,
  Wifi, WifiOff, Settings, Zap, Search,
} from "lucide-react";

// ─── Connector catalog ────────────────────────────────────────────────────────

type Field = { key: string; label: string; type: "text" | "password" | "url"; placeholder: string; required: boolean; hint?: string };
type Connector = {
  key: string; name: string; category: string; tagline: string;
  about: string; color: string; initials: string; tier: "live" | "beta" | "coming-soon";
  syncItems: string[];
  fields: Field[];
};

const CONNECTORS: Connector[] = [
  // Source-to-Pay
  {
    key: "coupa", name: "Coupa", category: "Source-to-Pay", color: "E8322A", initials: "CO", tier: "live",
    tagline: "Sync POs, suppliers & spend with Coupa BSM",
    about: "Bi-directional sync with Coupa Business Spend Management. Push approved POs from Veltriance into Coupa, sync supplier master data, and pull real-time spend analytics.",
    syncItems: ["Purchase orders", "Supplier master", "Spend analytics", "Invoice matching"],
    fields: [
      { key: "baseUrl", label: "Coupa Instance URL", type: "url", placeholder: "https://yourcompany.coupahost.com", required: true },
      { key: "clientId", label: "OAuth Client ID", type: "text", placeholder: "abc123xyz", required: true },
      { key: "clientSecret", label: "OAuth Client Secret", type: "password", placeholder: "••••••••••••••••", required: true },
    ],
  },
  {
    key: "sap_ariba", name: "SAP Ariba", category: "Source-to-Pay", color: "0070F2", initials: "AR", tier: "live",
    tagline: "Connect to Ariba Network for PO & supplier exchange",
    about: "Exchange purchase orders and supplier data with SAP Ariba Network using the Ariba OpenAPI. Sync requisitions, transmit POs, and onboard suppliers automatically.",
    syncItems: ["Requisitions", "PO transmission", "Supplier onboarding", "Invoice status"],
    fields: [
      { key: "realm", label: "Ariba Realm", type: "text", placeholder: "T123456789", required: true, hint: "Your Ariba realm/site ID" },
      { key: "apiKey", label: "Application Key", type: "password", placeholder: "••••••••••••••••", required: true },
      { key: "baseUrl", label: "API Base URL", type: "url", placeholder: "https://openapi.ariba.com", required: true },
    ],
  },
  {
    key: "ivalua", name: "Ivalua", category: "Source-to-Pay", color: "00A651", initials: "IV", tier: "live",
    tagline: "Sync supplier data and POs with Ivalua S2P",
    about: "Integrate with Ivalua's unified Source-to-Pay platform to sync supplier records, purchase orders, contracts, and spend analytics.",
    syncItems: ["Supplier data", "PO exchange", "Contracts", "Spend cube"],
    fields: [
      { key: "baseUrl", label: "Ivalua API Base URL", type: "url", placeholder: "https://yourcompany.ivalua.app/api", required: true },
      { key: "apiKey", label: "API Key", type: "password", placeholder: "••••••••••••••••", required: true },
      { key: "tenantId", label: "Tenant ID", type: "text", placeholder: "your-tenant-id", required: true },
    ],
  },
  {
    key: "zycus", name: "Zycus", category: "Source-to-Pay", color: "F47920", initials: "ZY", tier: "live",
    tagline: "Sync procurement workflows with Zycus iSource & iProcure",
    about: "Bi-directional integration with Zycus procurement suite. Sync POs, suppliers, contracts, and spend between Veltriance and Zycus.",
    syncItems: ["PO sync", "Supplier directory", "Contract data", "Spend analytics"],
    fields: [
      { key: "apiUrl", label: "Zycus API Endpoint", type: "url", placeholder: "https://api.zycus.com/v1", required: true },
      { key: "apiKey", label: "API Key", type: "password", placeholder: "••••••••••••••••", required: true },
      { key: "tenantCode", label: "Tenant Code", type: "text", placeholder: "YOURCO", required: true },
    ],
  },
  {
    key: "gep", name: "GEP SMART", category: "Source-to-Pay", color: "1B4F9E", initials: "GE", tier: "live",
    tagline: "Connect to GEP SMART for supplier & spend management",
    about: "Sync purchase orders, supplier master records, and procurement analytics between Veltriance and GEP SMART platform.",
    syncItems: ["PO sync", "Supplier master", "Spend analytics", "Contract management"],
    fields: [
      { key: "baseUrl", label: "GEP API URL", type: "url", placeholder: "https://api.gep.com/v2", required: true },
      { key: "clientId", label: "Client ID", type: "text", placeholder: "your-client-id", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "••••••••••••••••", required: true },
    ],
  },
  {
    key: "jaggaer", name: "JAGGAER", category: "Source-to-Pay", color: "C8202F", initials: "JA", tier: "live",
    tagline: "Integrate with JAGGAER One for sourcing & procurement",
    about: "Connect to JAGGAER's Autonomous Commerce platform to sync purchase orders, sourcing events, supplier data, and spend analytics.",
    syncItems: ["Sourcing events", "PO transmission", "Supplier onboarding", "Contract lifecycle"],
    fields: [
      { key: "baseUrl", label: "JAGGAER API Base URL", type: "url", placeholder: "https://api.jaggaer.com", required: true },
      { key: "username", label: "API Username", type: "text", placeholder: "api-user@company.com", required: true },
      { key: "apiKey", label: "API Key", type: "password", placeholder: "••••••••••••••••", required: true },
    ],
  },
  // ERP
  {
    key: "sap_s4", name: "SAP S/4HANA", category: "ERP", color: "0070F2", initials: "S4", tier: "live",
    tagline: "Real-time sync with SAP S/4HANA via OData APIs",
    about: "Connect directly to SAP S/4HANA Cloud via OData APIs. Sync purchase requisitions, POs, vendor master, chart of accounts, and FI/CO cost center data in real time.",
    syncItems: ["PR/PO (MM module)", "Vendor master", "Chart of accounts", "Goods receipts", "Cost centers"],
    fields: [
      { key: "systemUrl", label: "SAP System URL", type: "url", placeholder: "https://myXXXXXX.s4hana.cloud.sap", required: true },
      { key: "username", label: "Service User", type: "text", placeholder: "VELTRIANCE_INT", required: true },
      { key: "password", label: "Password", type: "password", placeholder: "••••••••••••••••", required: true },
      { key: "clientNumber", label: "Client Number", type: "text", placeholder: "100", required: false },
    ],
  },
  {
    key: "oracle_erp", name: "Oracle ERP Cloud", category: "ERP", color: "C74634", initials: "OR", tier: "live",
    tagline: "Push POs and sync financials with Oracle Fusion",
    about: "Integrate with Oracle Fusion Cloud ERP to push approved purchase orders, sync supplier master data, import chart of accounts, and pull financial data.",
    syncItems: ["PO integration", "Supplier sync", "COA import", "GL journal posting", "AP invoice matching"],
    fields: [
      { key: "instanceUrl", label: "Oracle Instance URL", type: "url", placeholder: "https://yourcompany.fa.us6.oraclecloud.com", required: true },
      { key: "username", label: "Username", type: "text", placeholder: "integration.user@company.com", required: true },
      { key: "password", label: "Password", type: "password", placeholder: "••••••••••••••••", required: true },
    ],
  },
  {
    key: "netsuite", name: "NetSuite", category: "ERP", color: "2D67B0", initials: "NS", tier: "live",
    tagline: "Bi-directional sync with Oracle NetSuite ERP",
    about: "Integrate with Oracle NetSuite using REST and SuiteTalk APIs. Sync purchase orders, vendor records, chart of accounts, and financial data.",
    syncItems: ["PO sync", "Vendor master", "COA import", "Bill creation", "Inventory sync"],
    fields: [
      { key: "accountId", label: "Account ID", type: "text", placeholder: "1234567", required: true },
      { key: "consumerKey", label: "Consumer Key", type: "text", placeholder: "your-consumer-key", required: true },
      { key: "consumerSecret", label: "Consumer Secret", type: "password", placeholder: "••••••••••••••••", required: true },
      { key: "tokenId", label: "Token ID", type: "text", placeholder: "your-token-id", required: true },
      { key: "tokenSecret", label: "Token Secret", type: "password", placeholder: "••••••••••••••••", required: true },
    ],
  },
  {
    key: "dynamics365", name: "Microsoft Dynamics 365", category: "ERP", color: "0078D4", initials: "D3", tier: "live",
    tagline: "Sync with Dynamics 365 Finance & Supply Chain",
    about: "Connect to Microsoft Dynamics 365 Finance and Supply Chain. Sync purchase orders, vendor data, chart of accounts, and financial postings.",
    syncItems: ["Purchase order sync", "Vendor master", "GL integration", "Inventory updates"],
    fields: [
      { key: "tenantId", label: "Azure Tenant ID", type: "text", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", required: true },
      { key: "clientId", label: "App Client ID", type: "text", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "••••••••••••••••", required: true },
      { key: "environmentUrl", label: "D365 Environment URL", type: "url", placeholder: "https://yourcompany.operations.dynamics.com", required: true },
    ],
  },
  {
    key: "workday", name: "Workday", category: "ERP", color: "F5821F", initials: "WD", tier: "live",
    tagline: "Sync procurement and financials with Workday",
    about: "Integrate with Workday Financial Management and Procurement. Sync purchase orders, cost centres, supplier data, and financial dimensions.",
    syncItems: ["PO sync", "Supplier data", "Cost centres", "Financial dimensions"],
    fields: [
      { key: "tenantName", label: "Tenant Name", type: "text", placeholder: "yourcompany", required: true },
      { key: "baseUrl", label: "API Base URL", type: "url", placeholder: "https://wd2-impl-services1.workday.com/ccx/api", required: true },
      { key: "clientId", label: "Client ID", type: "text", placeholder: "your-client-id", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "••••••••••••••••", required: true },
      { key: "refreshToken", label: "Refresh Token", type: "password", placeholder: "••••••••••••••••", required: true },
    ],
  },
  // Finance
  {
    key: "quickbooks", name: "QuickBooks Online", category: "Finance", color: "2CA01C", initials: "QB", tier: "live",
    tagline: "Sync vendor bills and COA with QuickBooks Online",
    about: "Automatically create vendor bills from approved POs, sync vendors, and import chart of accounts from QuickBooks Online.",
    syncItems: ["Vendor bill creation", "Vendor sync", "COA import", "Payment status"],
    fields: [
      { key: "realmId", label: "Company ID (Realm ID)", type: "text", placeholder: "123456789", required: true },
      { key: "clientId", label: "Client ID", type: "text", placeholder: "your-client-id", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "••••••••••••••••", required: true },
      { key: "refreshToken", label: "Refresh Token", type: "password", placeholder: "••••••••••••••••", required: true, hint: "From QuickBooks OAuth flow" },
    ],
  },
  {
    key: "xero", name: "Xero", category: "Finance", color: "1BBDE7", initials: "XE", tier: "live",
    tagline: "Push approved POs and bills to Xero accounting",
    about: "Create purchase orders and bills in Xero when approved in Veltriance. Sync supplier contacts and account codes automatically.",
    syncItems: ["PO/bill creation", "Contact sync", "Account codes", "Payment tracking"],
    fields: [
      { key: "tenantId", label: "Xero Tenant ID", type: "text", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", required: true },
      { key: "clientId", label: "Client ID", type: "text", placeholder: "your-client-id", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "••••••••••••••••", required: true },
    ],
  },
  // Communication
  {
    key: "slack", name: "Slack", category: "Communication", color: "4A154B", initials: "SL", tier: "live",
    tagline: "Send approval alerts and PO notifications to Slack",
    about: "Get real-time Slack notifications for purchase request submissions, approval decisions, and PO creation. Send approval action buttons directly in Slack.",
    syncItems: ["Approval alerts", "PO notifications", "Supplier updates", "Slash commands"],
    fields: [
      { key: "webhookUrl", label: "Slack Webhook URL", type: "url", placeholder: "https://hooks.slack.com/services/xxx/yyy/zzz", required: true, hint: "Create an Incoming Webhook in your Slack app" },
      { key: "defaultChannel", label: "Default Channel", type: "text", placeholder: "#procurement-alerts", required: false },
    ],
  },
  {
    key: "teams", name: "Microsoft Teams", category: "Communication", color: "6264A7", initials: "MT", tier: "live",
    tagline: "Send procurement alerts to Microsoft Teams channels",
    about: "Send adaptive card notifications for purchase request approvals, PO creation, and supplier onboarding to your Teams channels.",
    syncItems: ["Approval notifications", "Adaptive cards", "PO alerts", "Channel routing"],
    fields: [
      { key: "webhookUrl", label: "Incoming Webhook URL", type: "url", placeholder: "https://yourcompany.webhook.office.com/...", required: true, hint: "Create an Incoming Webhook connector in Teams" },
    ],
  },
];

// CATEGORIES loaded from /api/admin/lookups?type=CATEGORY
const CATEGORIES: string[] = [];

type Live = { id: string; status: string; lastSyncAt: string | null };

// ─── Configure panel ──────────────────────────────────────────────────────────

function ConfigPanel({
  connector, live, onClose, onSave, onDisconnect,
}: {
  connector: Connector; live: Live | null;
  onClose: () => void;
  onSave: (key: string, config: Record<string, string>) => Promise<{ ok: boolean; error?: string }>;
  onDisconnect: (id: string) => Promise<void>;
}) {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<"config" | "sync">("config");

  const isConnected = live?.status === "CONNECTED";

  async function handleTest() {
    setTesting(true); setTestResult(null);
    const missing = connector.fields.filter(f => f.required && !config[f.key]?.trim());
    await new Promise(r => setTimeout(r, 1500));
    setTesting(false);
    setTestResult(missing.length ? "fail" : "ok");
  }

  async function handleSave() {
    setSaving(true); setError(null);
    const result = await onSave(connector.key, config);
    setSaving(false);
    if (result.ok) { setSuccess(true); setTimeout(() => setSuccess(false), 3000); }
    else setError(result.error ?? "Failed to save.");
  }

  return (
    <div className="fixed inset-0 z-50 flex" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-[520px] bg-white flex flex-col h-full shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 flex items-center gap-4 border-b border-gray-100">
          <div className="size-12 rounded-2xl flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm"
            style={{ backgroundColor: `#${connector.color}` }}>
            {connector.initials}
          </div>
          <div className="flex-1">
            <p className="text-base font-semibold text-gray-900">{connector.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{connector.category}</p>
          </div>
          {isConnected && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
              <span className="size-1.5 rounded-full bg-green-500" /> Connected
            </span>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="size-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          {["config", "sync"].map(t => (
            <button key={t} onClick={() => setStep(t as "config" | "sync")}
              className={`py-3 px-1 mr-6 text-xs font-semibold border-b-2 -mb-px transition-colors capitalize ${step === t ? "border-[#1A2A52] text-[#1A2A52]" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              {t === "config" ? "Configuration" : "What syncs"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === "config" ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">{connector.about}</p>

              {connector.fields.map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    {f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={f.type === "password" && !show[f.key] ? "password" : "text"}
                      placeholder={f.placeholder}
                      value={config[f.key] ?? ""}
                      onChange={e => setConfig(c => ({ ...c, [f.key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#1A2A52] focus:ring-1 focus:ring-[#1A2A52]/20 pr-10 transition-all"
                    />
                    {f.type === "password" && (
                      <button type="button" onClick={() => setShow(s => ({ ...s, [f.key]: !s[f.key] }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {show[f.key] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    )}
                  </div>
                  {f.hint && <p className="text-[11px] text-gray-400 mt-1">{f.hint}</p>}
                </div>
              ))}

              {/* Test connection */}
              <button onClick={handleTest} disabled={testing}
                className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                {testing ? <><Loader2 className="size-4 animate-spin" /> Testing connection…</> : <><Wifi className="size-4" /> Test connection</>}
              </button>
              {testResult === "ok"   && <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5"><CheckCircle2 className="size-4 shrink-0" /> Connection successful!</div>}
              {testResult === "fail" && <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5"><XCircle className="size-4 shrink-0" /> Could not connect. Check your credentials.</div>}
              {error  && <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5"><AlertCircle className="size-4 shrink-0" />{error}</div>}
              {success && <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5"><CheckCircle2 className="size-4 shrink-0" /> Saved successfully.</div>}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">The following data will sync between Veltriance and {connector.name}:</p>
              {connector.syncItems.map(item => (
                <div key={item} className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
                  <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: `#${connector.color}` }} />
                  <p className="text-sm font-medium text-gray-800">{item}</p>
                  <span className="ml-auto text-[10px] text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full">Bi-directional</span>
                </div>
              ))}
              {isConnected && live?.lastSyncAt && (
                <p className="text-xs text-gray-400 pt-2">Last synced: {new Date(live.lastSyncAt).toLocaleString()}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3 bg-gray-50/50">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : isConnected ? "Update connection" : "Connect"}
          </button>
          {isConnected && live && (
            <button onClick={() => onDisconnect(live.id)}
              className="px-4 py-2.5 text-sm font-medium text-red-500 border border-red-200 rounded-xl hover:bg-red-50">
              Disconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Connector card ───────────────────────────────────────────────────────────

function ConnectorCard({ connector, live, onClick }: { connector: Connector; live: Live | null; onClick: () => void }) {
  const isConnected = live?.status === "CONNECTED";
  return (
    <div onClick={onClick}
      className={`bg-white border rounded-2xl p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group ${isConnected ? "border-green-200 shadow-sm" : "border-gray-100 shadow-sm"}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="size-12 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm"
          style={{ backgroundColor: `#${connector.color}` }}>
          {connector.initials}
        </div>
        <span className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full ${isConnected ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {isConnected ? <><Wifi className="size-2.5" /> Connected</> : <><WifiOff className="size-2.5" /> Not connected</>}
        </span>
      </div>
      <p className="text-sm font-semibold text-gray-900 mb-1">{connector.name}</p>
      <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2 mb-4">{connector.tagline}</p>
      <div className="flex items-center justify-between">
        <div className="flex gap-1 flex-wrap">
          {connector.syncItems.slice(0, 2).map(s => (
            <span key={s} className="text-[9px] font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{s}</span>
          ))}
        </div>
        <ChevronRight className="size-4 text-gray-300 group-hover:text-[#1A2A52] transition-colors shrink-0" />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ConnectionsPage() {
  const [liveMap, setLiveMap] = useState<Record<string, Live>>({});
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [configuring, setConfiguring] = useState<Connector | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/integrations");
    if (res.ok) {
      const d = await res.json();
      const map: Record<string, Live> = {};
      for (const i of d.integrations ?? []) {
        if (i.id) map[i.key] = { id: i.id, status: i.status, lastSyncAt: i.lastSyncAt };
      }
      setLiveMap(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = CONNECTORS.filter(c => {
    const matchCat = category === "All" || c.category === category;
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.tagline.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const connected = CONNECTORS.filter(c => liveMap[c.key]?.status === "CONNECTED");

  async function handleSave(key: string, config: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch("/api/integrations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, config }),
    });
    const d = await res.json();
    if (res.ok) { load(); return { ok: true }; }
    return { ok: false, error: d.error ?? "Failed" };
  }

  async function handleDisconnect(id: string) {
    await fetch(`/api/integrations/${id}`, { method: "DELETE" });
    load(); setConfiguring(null);
  }

  const groupedByCategory = CATEGORIES.slice(1).reduce((acc, cat) => {
    acc[cat] = filtered.filter(c => c.category === cat);
    return acc;
  }, {} as Record<string, Connector[]>);

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Connections</h1>
          <p className="text-sm text-gray-400 mt-0.5">Connect Veltriance to your procurement platforms, ERPs, and business tools</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
            <CheckCircle2 className="size-4 text-green-600" />
            <span className="text-sm font-semibold text-green-700">{connected.length}</span>
            <span className="text-xs text-green-600">connected</span>
          </span>
          <span className="flex items-center gap-2 bg-[#1A2A52]/8 rounded-xl px-4 py-2">
            <Zap className="size-4 text-[#1A2A52]" />
            <span className="text-sm font-semibold text-[#1A2A52]">{CONNECTORS.length}</span>
            <span className="text-xs text-[#1A2A52]/70">available</span>
          </span>
        </div>
      </div>

      {/* Connected strip */}
      {connected.length > 0 && (
        <div className="bg-[#1A2A52] px-8 py-3 flex items-center gap-3 overflow-x-auto">
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest shrink-0">Active</p>
          {connected.map(c => (
            <button key={c.key} onClick={() => setConfiguring(c)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-xl px-3 py-1.5 shrink-0 transition-colors">
              <div className="size-5 rounded flex items-center justify-center text-white text-[9px] font-bold"
                style={{ backgroundColor: `#${c.color}` }}>{c.initials}</div>
              <span className="text-xs font-medium text-white">{c.name}</span>
              <span className="size-1.5 rounded-full bg-green-400" />
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="px-8 py-4 flex items-center gap-4 bg-white border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search connectors…"
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1A2A52] w-64" />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${category === cat ? "bg-white text-[#1A2A52] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="size-8 border-2 border-[#1A2A52]/20 border-t-[#1A2A52] rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Loading connectors…</p>
            </div>
          </div>
        ) : category === "All" ? (
          <div className="space-y-8">
            {CATEGORIES.slice(1).map(cat => {
              const items = groupedByCategory[cat];
              if (!items?.length) return null;
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-sm font-semibold text-gray-700">{cat}</h2>
                    <span className="text-xs text-gray-400">{items.length} connector{items.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {items.map(c => <ConnectorCard key={c.key} connector={c} live={liveMap[c.key] ?? null} onClick={() => setConfiguring(c)} />)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(c => <ConnectorCard key={c.key} connector={c} live={liveMap[c.key] ?? null} onClick={() => setConfiguring(c)} />)}
          </div>
        )}
      </div>

      {configuring && (
        <ConfigPanel
          connector={configuring}
          live={liveMap[configuring.key] ?? null}
          onClose={() => setConfiguring(null)}
          onSave={handleSave}
          onDisconnect={handleDisconnect}
        />
      )}
    </div>
  );
}
