// ─── Integration Catalog ─────────────────────────────────────────────────────
// Central registry of all supported integrations.
// Add new integrations here — no other file needs to change.

export type ConfigField = {
  key: string;
  label: string;
  type: "text" | "password" | "url";
  placeholder: string;
  required: boolean;
  helpText?: string;
};

export type IntegrationDef = {
  key: string;
  name: string;
  category: "source-to-pay" | "erp" | "finance" | "communication";
  description: string;
  longDescription: string;
  logoColor: string; // brand color for the icon placeholder
  logoInitials: string;
  tier: "available" | "coming-soon" | "enterprise";
  fields: ConfigField[];
  docsUrl?: string;
  features: string[];
};

export const INTEGRATION_CATALOG: IntegrationDef[] = [
  // ── Source-to-Pay ───────────────────────────────────────────────────────────
  {
    key: "coupa",
    name: "Coupa",
    category: "source-to-pay",
    description: "Connect Veltriance to Coupa to sync purchase orders, suppliers, and spend data.",
    longDescription: "Bi-directional sync with Coupa Business Spend Management. Automatically push approved POs from Veltriance into Coupa, sync supplier master data, and pull real-time spend analytics.",
    logoColor: "E8322A",
    logoInitials: "CO",
    tier: "available",
    features: ["PO sync (Veltriance → Coupa)", "Supplier master sync", "Spend analytics pull", "Invoice matching"],
    docsUrl: "https://compass.coupa.com/en-US/documentation/technical_documentation/api/api_documentation_portal",
    fields: [
      { key: "baseUrl", label: "Coupa Instance URL", type: "url", placeholder: "https://yourcompany.coupahost.com", required: true, helpText: "Your Coupa instance URL" },
      { key: "clientId", label: "OAuth Client ID", type: "text", placeholder: "abc123xyz", required: true },
      { key: "clientSecret", label: "OAuth Client Secret", type: "password", placeholder: "••••••••••••••••", required: true },
      { key: "scope", label: "API Scope", type: "text", placeholder: "core.purchase_orders.read core.suppliers.write", required: false, helpText: "Space-separated OAuth scopes" },
    ],
  },
  {
    key: "sap_ariba",
    name: "SAP Ariba",
    category: "source-to-pay",
    description: "Integrate with SAP Ariba Procurement to sync requisitions, POs, and supplier data.",
    longDescription: "Connect Veltriance to SAP Ariba Network and Ariba Procurement to exchange requisitions, purchase orders, and supplier information using the Ariba Network APIs.",
    logoColor: "0070F2",
    logoInitials: "SA",
    tier: "available",
    features: ["Requisition sync", "PO transmission to Ariba Network", "Supplier onboarding", "Invoice status"],
    docsUrl: "https://developer.ariba.com/api",
    fields: [
      { key: "realm", label: "Ariba Realm", type: "text", placeholder: "T123456789", required: true, helpText: "Your Ariba realm/site ID" },
      { key: "apiKey", label: "Application Key", type: "password", placeholder: "••••••••••••••••", required: true },
      { key: "baseUrl", label: "API Base URL", type: "url", placeholder: "https://openapi.ariba.com", required: true },
      { key: "environment", label: "Environment", type: "text", placeholder: "production", required: false, helpText: "production or sandbox" },
    ],
  },
  {
    key: "ivalua",
    name: "Ivalua",
    category: "source-to-pay",
    description: "Sync procurement data between Veltriance and Ivalua Spend Management.",
    longDescription: "Integrate with Ivalua's unified Source-to-Pay platform. Sync supplier data, purchase orders, contracts, and spend analytics in real time.",
    logoColor: "00A651",
    logoInitials: "IV",
    tier: "available",
    features: ["Supplier data sync", "PO exchange", "Contract data pull", "Spend cube integration"],
    fields: [
      { key: "baseUrl", label: "Ivalua API Base URL", type: "url", placeholder: "https://yourcompany.ivalua.app/api", required: true },
      { key: "apiKey", label: "API Key", type: "password", placeholder: "••••••••••••••••", required: true },
      { key: "tenantId", label: "Tenant ID", type: "text", placeholder: "your-tenant-id", required: true },
    ],
  },
  {
    key: "gep",
    name: "GEP SMART",
    category: "source-to-pay",
    description: "Connect to GEP SMART procurement platform for supplier and spend management.",
    longDescription: "Integrate Veltriance with GEP SMART to synchronise purchase orders, supplier master records, and procurement analytics across both platforms.",
    logoColor: "1B4F9E",
    logoInitials: "GE",
    tier: "available",
    features: ["PO sync", "Supplier master", "Spend analytics", "Contract management"],
    fields: [
      { key: "baseUrl", label: "GEP API URL", type: "url", placeholder: "https://api.gep.com/v2", required: true },
      { key: "clientId", label: "Client ID", type: "text", placeholder: "your-client-id", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "••••••••••••••••", required: true },
    ],
  },
  {
    key: "zycus",
    name: "Zycus",
    category: "source-to-pay",
    description: "Sync procurement workflows between Veltriance and Zycus iSource / iProcure.",
    longDescription: "Bi-directional integration with Zycus procurement suite — sync POs, suppliers, contracts, and spend analytics between Veltriance and Zycus iSource, iProcure, and iContract.",
    logoColor: "F47920",
    logoInitials: "ZY",
    tier: "available",
    features: ["PO sync", "Supplier directory", "Contract data", "Spend analytics"],
    fields: [
      { key: "apiUrl", label: "Zycus API Endpoint", type: "url", placeholder: "https://api.zycus.com/v1", required: true },
      { key: "apiKey", label: "API Key", type: "password", placeholder: "••••••••••••••••", required: true },
      { key: "tenantCode", label: "Tenant Code", type: "text", placeholder: "YOURCO", required: true },
    ],
  },
  {
    key: "jaggaer",
    name: "JAGGAER",
    category: "source-to-pay",
    description: "Integrate with JAGGAER One for sourcing, procurement, and supplier management.",
    longDescription: "Connect to JAGGAER's Autonomous Commerce platform to sync purchase orders, sourcing events, supplier data, and spend analytics.",
    logoColor: "C8202F",
    logoInitials: "JA",
    tier: "available",
    features: ["Sourcing event sync", "PO transmission", "Supplier onboarding", "Contract lifecycle"],
    fields: [
      { key: "baseUrl", label: "JAGGAER API Base URL", type: "url", placeholder: "https://api.jaggaer.com", required: true },
      { key: "username", label: "API Username", type: "text", placeholder: "api-user@yourcompany.com", required: true },
      { key: "apiKey", label: "API Key", type: "password", placeholder: "••••••••••••••••", required: true },
    ],
  },
  {
    key: "basware",
    name: "Basware",
    category: "source-to-pay",
    description: "Connect to Basware for AP automation, e-invoicing, and procurement analytics.",
    longDescription: "Integrate with Basware's purchase-to-pay platform to automate invoice processing, sync purchase orders, and connect supplier networks.",
    logoColor: "0066CC",
    logoInitials: "BW",
    tier: "coming-soon",
    features: ["AP automation sync", "E-invoice exchange", "PO matching", "Supplier network"],
    fields: [
      { key: "clientId", label: "Client ID", type: "text", placeholder: "your-client-id", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "••••••••••••••••", required: true },
      { key: "environment", label: "Environment", type: "text", placeholder: "production", required: false },
    ],
  },

  // ── ERP ─────────────────────────────────────────────────────────────────────
  {
    key: "sap_s4",
    name: "SAP S/4HANA",
    category: "erp",
    description: "Deep integration with SAP S/4HANA for real-time financial and procurement data.",
    longDescription: "Connect Veltriance directly to SAP S/4HANA via OData APIs. Sync purchase requisitions, purchase orders, goods receipts, vendor master data, and chart of accounts in real time.",
    logoColor: "0070F2",
    logoInitials: "S4",
    tier: "available",
    features: ["PR/PO sync (MM module)", "Vendor master sync", "Chart of accounts import", "Goods receipt posting", "FI/CO cost center data"],
    docsUrl: "https://api.sap.com/package/SAPS4HANACloud",
    fields: [
      { key: "systemUrl", label: "SAP System URL", type: "url", placeholder: "https://myXXXXXX.s4hana.cloud.sap", required: true, helpText: "Your SAP S/4HANA Cloud URL" },
      { key: "username", label: "Service User", type: "text", placeholder: "VELTRIANCE_INT", required: true },
      { key: "password", label: "Password", type: "password", placeholder: "••••••••••••••••", required: true },
      { key: "clientNumber", label: "Client Number", type: "text", placeholder: "100", required: false },
    ],
  },
  {
    key: "oracle_erp",
    name: "Oracle ERP Cloud",
    category: "erp",
    description: "Sync purchase orders, suppliers, and financials with Oracle ERP Cloud.",
    longDescription: "Integrate with Oracle Fusion Cloud ERP to push approved purchase orders, sync supplier master data, import chart of accounts, and pull real-time financial data.",
    logoColor: "C74634",
    logoInitials: "OR",
    tier: "available",
    features: ["PO integration", "Supplier sync", "COA import", "GL journal posting", "AP invoice matching"],
    docsUrl: "https://docs.oracle.com/en/cloud/saas/procurement/",
    fields: [
      { key: "instanceUrl", label: "Oracle Instance URL", type: "url", placeholder: "https://yourcompany.fa.us6.oraclecloud.com", required: true },
      { key: "username", label: "Username", type: "text", placeholder: "integration.user@yourcompany.com", required: true },
      { key: "password", label: "Password", type: "password", placeholder: "••••••••••••••••", required: true },
      { key: "clientId", label: "OAuth Client ID", type: "text", placeholder: "your-client-id", required: false, helpText: "For OAuth 2.0 (recommended)" },
      { key: "clientSecret", label: "OAuth Client Secret", type: "password", placeholder: "••••••••••••••••", required: false },
    ],
  },
  {
    key: "netsuite",
    name: "NetSuite",
    category: "erp",
    description: "Connect Veltriance to Oracle NetSuite for procurement and financial integration.",
    longDescription: "Bi-directional integration with Oracle NetSuite ERP. Sync purchase orders, vendor records, chart of accounts, and financial data using NetSuite REST and SuiteTalk APIs.",
    logoColor: "2D67B0",
    logoInitials: "NS",
    tier: "available",
    features: ["PO sync", "Vendor master", "COA import", "Bill creation", "Item/inventory sync"],
    docsUrl: "https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N2874000.html",
    fields: [
      { key: "accountId", label: "Account ID", type: "text", placeholder: "1234567", required: true, helpText: "Your NetSuite account/company ID" },
      { key: "consumerKey", label: "Consumer Key", type: "text", placeholder: "your-consumer-key", required: true },
      { key: "consumerSecret", label: "Consumer Secret", type: "password", placeholder: "••••••••••••••••", required: true },
      { key: "tokenId", label: "Token ID", type: "text", placeholder: "your-token-id", required: true },
      { key: "tokenSecret", label: "Token Secret", type: "password", placeholder: "••••••••••••••••", required: true },
    ],
  },
  {
    key: "dynamics365",
    name: "Microsoft Dynamics 365",
    category: "erp",
    description: "Integrate with Dynamics 365 Finance & Supply Chain for procurement workflows.",
    longDescription: "Connect Veltriance to Microsoft Dynamics 365 Finance, Supply Chain, and Business Central. Sync purchase orders, vendor data, chart of accounts, and financial postings.",
    logoColor: "0078D4",
    logoInitials: "D3",
    tier: "available",
    features: ["Purchase order sync", "Vendor master", "GL integration", "Inventory updates", "Business Central support"],
    docsUrl: "https://docs.microsoft.com/en-us/dynamics365/fin-ops-core/dev-itpro/data-entities/odata",
    fields: [
      { key: "tenantId", label: "Azure Tenant ID", type: "text", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", required: true },
      { key: "clientId", label: "App Client ID", type: "text", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "••••••••••••••••", required: true },
      { key: "environmentUrl", label: "D365 Environment URL", type: "url", placeholder: "https://yourcompany.operations.dynamics.com", required: true },
    ],
  },
  {
    key: "workday",
    name: "Workday",
    category: "erp",
    description: "Sync procurement and financial data between Veltriance and Workday.",
    longDescription: "Integrate with Workday Financial Management and Procurement. Sync purchase orders, cost centres, supplier data, and financial dimensions using Workday REST and SOAP APIs.",
    logoColor: "F5821F",
    logoInitials: "WD",
    tier: "available",
    features: ["PO sync", "Supplier data", "Cost centre import", "Spend analytics", "Financial dimensions"],
    docsUrl: "https://developer.workday.com",
    fields: [
      { key: "tenantName", label: "Tenant Name", type: "text", placeholder: "yourcompany", required: true, helpText: "Your Workday tenant alias" },
      { key: "baseUrl", label: "API Base URL", type: "url", placeholder: "https://wd2-impl-services1.workday.com/ccx/api", required: true },
      { key: "clientId", label: "Client ID", type: "text", placeholder: "your-client-id", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "••••••••••••••••", required: true },
      { key: "refreshToken", label: "Refresh Token", type: "password", placeholder: "••••••••••••••••", required: true },
    ],
  },
  {
    key: "sap_ecc",
    name: "SAP ECC (On-Premise)",
    category: "erp",
    description: "Connect to legacy SAP ECC systems via RFC/BAPI or OData middleware.",
    longDescription: "Integrate with SAP ECC on-premise systems using RFC/BAPI calls or via an SAP PI/PO or BTP middleware layer. Supports MM, FI, and SD module data exchange.",
    logoColor: "0070F2",
    logoInitials: "EC",
    tier: "enterprise",
    features: ["MM module (PR/PO)", "FI/GL posting", "Vendor master (LFA1)", "BTP middleware support", "RFC/BAPI interface"],
    fields: [
      { key: "middlewareUrl", label: "Middleware/Gateway URL", type: "url", placeholder: "https://your-sap-gateway.company.com/sap/opu/odata", required: true, helpText: "SAP Gateway or BTP OData endpoint" },
      { key: "username", label: "Service Account", type: "text", placeholder: "VELTRIANCE_SRV", required: true },
      { key: "password", label: "Password", type: "password", placeholder: "••••••••••••••••", required: true },
      { key: "systemId", label: "System ID (SID)", type: "text", placeholder: "PRD", required: false },
    ],
  },

  // ── Finance ─────────────────────────────────────────────────────────────────
  {
    key: "quickbooks",
    name: "QuickBooks Online",
    category: "finance",
    description: "Sync purchase orders and vendor bills with QuickBooks Online.",
    longDescription: "Connect Veltriance to QuickBooks Online to automatically create vendor bills from approved POs, sync vendors, and import chart of accounts.",
    logoColor: "2CA01C",
    logoInitials: "QB",
    tier: "available",
    features: ["Vendor bill creation", "Vendor sync", "COA import", "Payment status"],
    docsUrl: "https://developer.intuit.com/app/developer/qbo/docs/api/accounting",
    fields: [
      { key: "realmId", label: "Company ID (Realm ID)", type: "text", placeholder: "123456789", required: true },
      { key: "clientId", label: "Client ID", type: "text", placeholder: "your-client-id", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "••••••••••••••••", required: true },
      { key: "refreshToken", label: "Refresh Token", type: "password", placeholder: "••••••••••••••••", required: true, helpText: "Obtained via QuickBooks OAuth flow" },
    ],
  },
  {
    key: "xero",
    name: "Xero",
    category: "finance",
    description: "Push approved purchase orders and bills to Xero accounting.",
    longDescription: "Integrate Veltriance with Xero to automatically create purchase orders and bills in Xero when approved, sync supplier contacts, and import account codes.",
    logoColor: "1BBDE7",
    logoInitials: "XE",
    tier: "available",
    features: ["PO/bill creation", "Contact sync", "Account code import", "Payment tracking"],
    fields: [
      { key: "tenantId", label: "Xero Tenant ID", type: "text", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", required: true },
      { key: "clientId", label: "Client ID", type: "text", placeholder: "your-client-id", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "••••••••••••••••", required: true },
    ],
  },
  {
    key: "tally",
    name: "Tally Prime",
    category: "finance",
    description: "Integrate with Tally Prime for Indian accounting and compliance.",
    longDescription: "Connect Veltriance to Tally Prime using Tally's XML/JSON gateway. Push vouchers, sync ledgers, and handle GST compliance data for Indian businesses.",
    logoColor: "1D56A6",
    logoInitials: "TP",
    tier: "coming-soon",
    features: ["Voucher posting", "Ledger sync", "GST compliance", "Cost centre mapping"],
    fields: [
      { key: "gatewayUrl", label: "Tally Gateway URL", type: "url", placeholder: "http://localhost:9000", required: true, helpText: "Tally XML/JSON gateway endpoint" },
      { key: "companyName", label: "Company Name in Tally", type: "text", placeholder: "My Company Ltd", required: true },
    ],
  },

  // ── Communication ────────────────────────────────────────────────────────────
  {
    key: "slack",
    name: "Slack",
    category: "communication",
    description: "Send procurement notifications and approval alerts to Slack channels.",
    longDescription: "Get real-time Slack notifications for purchase request submissions, approval actions, PO creation, and supplier onboarding events. Support for approval actions directly from Slack.",
    logoColor: "4A154B",
    logoInitials: "SL",
    tier: "available",
    features: ["Approval alerts", "PO notifications", "Supplier updates", "Slash command support"],
    docsUrl: "https://api.slack.com/",
    fields: [
      { key: "webhookUrl", label: "Slack Webhook URL", type: "url", placeholder: "https://hooks.slack.com/services/xxx/yyy/zzz", required: true, helpText: "Create an Incoming Webhook in your Slack app settings" },
      { key: "defaultChannel", label: "Default Channel", type: "text", placeholder: "#procurement-alerts", required: false },
      { key: "botToken", label: "Bot Token (optional)", type: "password", placeholder: "xoxb-••••••••••••••••", required: false, helpText: "Required for interactive approval actions" },
    ],
  },
  {
    key: "teams",
    name: "Microsoft Teams",
    category: "communication",
    description: "Send procurement alerts and approvals to Microsoft Teams channels.",
    longDescription: "Integrate Veltriance with Microsoft Teams to send adaptive card notifications for purchase request approvals, PO creation, and supplier onboarding directly to your Teams channels.",
    logoColor: "6264A7",
    logoInitials: "MT",
    tier: "available",
    features: ["Approval notifications", "Adaptive cards", "PO alerts", "Channel configuration"],
    fields: [
      { key: "webhookUrl", label: "Incoming Webhook URL", type: "url", placeholder: "https://yourcompany.webhook.office.com/webhookb2/...", required: true, helpText: "Create an Incoming Webhook connector in Teams" },
      { key: "tenantId", label: "Azure Tenant ID", type: "text", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", required: false, helpText: "Required for SSO-based notifications" },
    ],
  },
];

export const CATEGORIES = [
  { key: "all",            label: "All Integrations" },
  { key: "source-to-pay", label: "Source-to-Pay"     },
  { key: "erp",           label: "ERP Systems"       },
  { key: "finance",       label: "Finance & Accounting" },
  { key: "communication", label: "Communication"      },
] as const;
