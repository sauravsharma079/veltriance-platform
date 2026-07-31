import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MODULE_SCOPES: Record<string, string> = {
  requisitions: "requisitions:read requisitions:write",
  suppliers: "suppliers:read suppliers:write",
  admin: "lookup_values:read lookup_values:write users:read users:write admin:read",
  catalogs: "catalogs:read catalogs:write",
};
const ALL_SCOPES = "requisitions:read requisitions:write purchase_orders:read purchase_orders:write suppliers:read suppliers:write lookup_values:read lookup_values:write users:read users:write admin:read catalogs:read catalogs:write";

function bearer(baseUrl: string, path: string, method = "GET", body?: any) {
  return {
    method, url: baseUrl + path,
    auth: { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}" }] },
    ...(body ? { header: [{ key: "Content-Type", value: "application/json" }], body: { mode: "raw", raw: JSON.stringify(body, null, 2) } } : {}),
  };
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.veltriance.com";
  const module = req.nextUrl.searchParams.get("module");
  const scope = (module && MODULE_SCOPES[module]) || ALL_SCOPES;

  const testScript = "const r=pm.response.json();if(r.access_token){pm.collectionVariables.set('accessToken',r.access_token);}";

  const authItem = {
    name: "1. Authentication",
    item: [{
      name: "Get Access Token",
      event: [{ listen: "test", script: { exec: [testScript], type: "text/javascript" } }],
      request: {
        method: "POST",
        url: baseUrl + "/api/oauth2/token",
        header: [{ key: "Content-Type", value: "application/x-www-form-urlencoded" }],
        body: {
          mode: "urlencoded",
          urlencoded: [
            { key: "grant_type",    value: "client_credentials" },
            { key: "client_id",     value: "{{clientId}}" },
            { key: "client_secret", value: "{{clientSecret}}" },
            { key: "scope",         value: scope },
          ],
        },
      },
    }],
  };

  const requisitionsItem = {
    name: "2. Requisitions", module: "requisitions",
    item: [
      { name: "List All Requisitions", request: bearer(baseUrl, "/api/v1/requisitions?limit=50&offset=0") },
      { name: "List Approved Requisitions", request: bearer(baseUrl, "/api/v1/requisitions?status=APPROVED&limit=50") },
      { name: "List High Priority", request: bearer(baseUrl, "/api/v1/requisitions?priority=HIGH&limit=50") },
      { name: "Bulk Upload Requisitions", request: bearer(baseUrl, "/api/upload/requisitions", "POST", {
        rows: [{ title: "MacBook Pro 14-inch for Engineering", category: "IT Hardware", amount: "142000", priority: "HIGH", department: "Engineering", requestorEmail: "requestor@yourcompany.com" }],
      }) },
    ],
  };

  const purchaseOrdersItem = {
    name: "3. Purchase Orders", module: "purchase-orders",
    item: [
      { name: "List Purchase Orders", request: bearer(baseUrl, "/api/v1/purchase-orders?limit=50") },
      { name: "List Sent POs", request: bearer(baseUrl, "/api/v1/purchase-orders?status=SENT") },
    ],
  };

  const suppliersItem = {
    name: "4. Suppliers", module: "suppliers",
    item: [
      { name: "List Active Suppliers", request: bearer(baseUrl, "/api/v1/suppliers?status=ACTIVE&limit=100") },
      { name: "List All Suppliers", request: bearer(baseUrl, "/api/v1/suppliers?limit=200") },
      { name: "Bulk Upload Suppliers", request: bearer(baseUrl, "/api/upload/suppliers", "POST", {
        rows: [{ name: "Test Vendor Ltd", category: "IT Hardware", contactEmail: "vendor@test.com", city: "Bengaluru", tier: "Tier 2", paymentTerms: "Net 30" }],
      }) },
    ],
  };

  const adminItem = {
    name: "5. Admin", module: "admin",
    item: [
      { name: "Get All Lookups",              request: bearer(baseUrl, "/api/v1/lookup-values") },
      { name: "Bulk Upload Lookup Values", request: bearer(baseUrl, "/api/upload/lookups", "POST", {
        rows: [{ type: "DEPARTMENT", code: "TECH", label: "Technology", sortOrder: "10" }],
      }) },
      { name: "Bulk Invite Users", request: bearer(baseUrl, "/api/upload/users", "POST", {
        rows: [{ name: "Rajesh Kumar", email: "rajesh@yourcompany.com", role: "REQUESTOR", department: "Engineering" }],
      }) },
    ],
  };

  const catalogsItem = {
    name: "6. Catalogs", module: "catalogs",
    item: [
      { name: "List Catalogs", request: bearer(baseUrl, "/api/catalogs") },
      { name: "List Hosted Catalog Items", request: bearer(baseUrl, "/api/catalogs/{{catalogId}}/items") },
      { name: "Bulk Upload Catalog Items", request: bearer(baseUrl, "/api/upload/catalog-items", "POST", {
        catalogId: "{{catalogId}}",
        rows: [{ sku: "ITEM-001", name: "Dell XPS 15 Laptop", unitPrice: "125000", currency: "INR", category: "IT Hardware", supplier: "Dell Technologies", unit: "Each", leadDays: "7", description: "Dell XPS 15 9530 16GB 512GB" }],
      }) },
    ],
  };

  const allModules: Record<string, any> = {
    requisitions: requisitionsItem,
    "purchase-orders": purchaseOrdersItem,
    suppliers: suppliersItem,
    admin: adminItem,
    catalogs: catalogsItem,
  };

  const item = module && allModules[module]
    ? [authItem, allModules[module]]
    : [authItem, requisitionsItem, purchaseOrdersItem, suppliersItem, adminItem, catalogsItem];

  const collection = {
    info: {
      name: module ? `Veltriance API — ${module[0].toUpperCase()}${module.slice(1)}` : "Veltriance Procurement API",
      description: "REST API for Veltriance Procurement Platform. Use OAuth 2.0 client credentials to authenticate. Bulk upload endpoints (/api/upload/*) accept the same bearer token and are usable from an external integration, not just the dashboard UI.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [
      { key: "baseUrl",      value: baseUrl,          type: "string" },
      { key: "clientId",     value: "vlt_client_xxx", type: "string" },
      { key: "clientSecret", value: "vlt_secret_xxx", type: "string" },
      { key: "accessToken",  value: "",               type: "string" },
      { key: "catalogId",    value: "",               type: "string" },
    ],
    item,
  };

  const filename = module ? `veltriance_${module}_collection.json` : "veltriance_api_collection.json";
  return new NextResponse(JSON.stringify(collection, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
