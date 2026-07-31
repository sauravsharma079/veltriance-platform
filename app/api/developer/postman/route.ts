import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.veltriance.com";

  const testScript = "const r=pm.response.json();if(r.access_token){pm.collectionVariables.set('accessToken',r.access_token);}";

  const collection = {
    info: {
      name: "Veltriance Procurement API",
      description: "REST API for Veltriance Procurement Platform. Use OAuth 2.0 client credentials to authenticate.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [
      { key: "baseUrl",      value: baseUrl,          type: "string" },
      { key: "clientId",     value: "vlt_client_xxx", type: "string" },
      { key: "clientSecret", value: "vlt_secret_xxx", type: "string" },
      { key: "accessToken",  value: "",               type: "string" },
    ],
    item: [
      {
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
                { key: "scope",         value: "requisitions:read purchase_orders:read suppliers:read" },
              ],
            },
          },
        }],
      },
      {
        name: "2. Requisitions",
        item: [
          { name: "List All Requisitions", request: { method: "GET", url: baseUrl + "/api/v1/requisitions?limit=50&offset=0", auth: { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}" }] } } },
          { name: "List Approved Requisitions", request: { method: "GET", url: baseUrl + "/api/v1/requisitions?status=APPROVED&limit=50", auth: { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}" }] } } },
          { name: "List High Priority", request: { method: "GET", url: baseUrl + "/api/v1/requisitions?priority=HIGH&limit=50", auth: { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}" }] } } },
        ],
      },
      {
        name: "3. Purchase Orders",
        item: [
          { name: "List Purchase Orders", request: { method: "GET", url: baseUrl + "/api/v1/purchase-orders?limit=50", auth: { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}" }] } } },
          { name: "List Sent POs", request: { method: "GET", url: baseUrl + "/api/v1/purchase-orders?status=SENT", auth: { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}" }] } } },
        ],
      },
      {
        name: "4. Suppliers",
        item: [
          { name: "List Active Suppliers", request: { method: "GET", url: baseUrl + "/api/v1/suppliers?status=ACTIVE&limit=100", auth: { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}" }] } } },
          { name: "List All Suppliers", request: { method: "GET", url: baseUrl + "/api/v1/suppliers?limit=200", auth: { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}" }] } } },
        ],
      },
      {
        name: "5. Admin APIs (Session Auth)",
        item: [
          { name: "Get All Lookups",              request: { method: "GET", url: baseUrl + "/api/admin/lookups" } },
          { name: "Get Delivery Addresses",       request: { method: "GET", url: baseUrl + "/api/admin/lookups?type=DELIVERY_ADDRESS" } },
          { name: "Get All Suppliers (Admin)",    request: { method: "GET", url: baseUrl + "/api/admin/suppliers" } },
          { name: "Get All Requisitions (Admin)", request: { method: "GET", url: baseUrl + "/api/admin/requisitions?limit=100" } },
        ],
      },
      {
        name: "6. Bulk Upload",
        item: [
          {
            name: "Upload Suppliers",
            request: {
              method: "POST", url: baseUrl + "/api/upload/suppliers",
              header: [{ key: "Content-Type", value: "application/json" }],
              body: { mode: "raw", raw: JSON.stringify({ rows: [{ name: "Test Vendor Ltd", category: "IT Hardware", contactEmail: "vendor@test.com", city: "Bengaluru", tier: "Tier 2", paymentTerms: "Net 30" }] }, null, 2) },
            },
          },
          {
            name: "Upload Lookup Values",
            request: {
              method: "POST", url: baseUrl + "/api/upload/lookups",
              header: [{ key: "Content-Type", value: "application/json" }],
              body: { mode: "raw", raw: JSON.stringify({ rows: [{ type: "DEPARTMENT", code: "TECH", label: "Technology", sortOrder: "10" }] }, null, 2) },
            },
          },
        ],
      },
    ],
  };

  return new NextResponse(JSON.stringify(collection, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": "attachment; filename=\"veltriance_api_collection.json\"",
    },
  });
}
