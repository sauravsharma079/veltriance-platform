import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.veltriance.com";

  const collection = {
    info: {
      name: "Veltriance Procurement API",
      description: "Complete REST API for the Veltriance Procurement Platform. Use OAuth 2.0 client credentials flow to authenticate.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      version: { major:1, minor:0, patch:0 },
    },
    variable: [
      { key:"baseUrl",      value:baseUrl,              type:"string" },
      { key:"clientId",     value:"vlt_client_xxx",     type:"string" },
      { key:"clientSecret", value:"vlt_secret_xxx",     type:"string" },
      { key:"accessToken",  value:"",                   type:"string" },
    ],
    auth: { type:"bearer", bearer:[{ key:"token", value:"{{accessToken}}", type:"string" }] },
    item: [
      {
        name:"1. Authentication",
        item:[{
          name:"Get Access Token",
          event:[{ listen:"test", script:{ exec:["const r = pm.response.json(); if (r.access_token) { pm.collectionVariables.set('accessToken', r.access_token); }"], type:"text/javascript" }}],
          request:{
            method:"POST", url:`${baseUrl}/api/oauth2/token`,
            header:[{ key:"Content-Type", value:"application/x-www-form-urlencoded" }],
            body:{ mode:"urlencoded", urlencoded:[
              { key:"grant_type",    value:"client_credentials" },
              { key:"client_id",     value:"{{clientId}}" },
              { key:"client_secret", value:"{{clientSecret}}" },
              { key:"scope",         value:"requisitions:read purchase_orders:read suppliers:read" },
            ]},
          },
        }],
      },
      {
        name:"2. Requisitions",
        item:[
          { name:"List Requisitions", request:{ method:"GET", url:{ raw:`${baseUrl}/api/v1/requisitions?limit=50&offset=0`, query:[{key:"status",value:"",disabled:true},{key:"priority",value:"",disabled:true},{key:"limit",value:"50"},{key:"offset",value:"0"}] }, auth:{ type:"bearer", bearer:[{key:"token",value:"{{accessToken}}"}] } } },
          { name:"List Approved Requisitions", request:{ method:"GET", url:`${baseUrl}/api/v1/requisitions?status=APPROVED&limit=50`, auth:{ type:"bearer", bearer:[{key:"token",value:"{{accessToken}}"}] } } },
          { name:"List High Priority", request:{ method:"GET", url:`${baseUrl}/api/v1/requisitions?priority=HIGH&limit=50`, auth:{ type:"bearer", bearer:[{key:"token",value:"{{accessToken}}"}] } } },
        ],
      },
      {
        name:"3. Purchase Orders",
        item:[
          { name:"List Purchase Orders", request:{ method:"GET", url:`${baseUrl}/api/v1/purchase-orders?limit=50`, auth:{ type:"bearer", bearer:[{key:"token",value:"{{accessToken}}"}] } } },
          { name:"List Sent POs", request:{ method:"GET", url:`${baseUrl}/api/v1/purchase-orders?status=SENT`, auth:{ type:"bearer", bearer:[{key:"token",value:"{{accessToken}}"}] } } },
        ],
      },
      {
        name:"4. Suppliers",
        item:[
          { name:"List Active Suppliers", request:{ method:"GET", url:`${baseUrl}/api/v1/suppliers?status=ACTIVE&limit=100`, auth:{ type:"bearer", bearer:[{key:"token",value:"{{accessToken}}"}] } } },
          { name:"List All Suppliers", request:{ method:"GET", url:`${baseUrl}/api/v1/suppliers?limit=200`, auth:{ type:"bearer", bearer:[{key:"token",value:"{{accessToken}}"}] } } },
        ],
      },
      {
        name:"5. Admin APIs",
        item:[
          { name:"Get All Lookups", request:{ method:"GET", url:`${baseUrl}/api/admin/lookups` } },
          { name:"Get Delivery Addresses", request:{ method:"GET", url:`${baseUrl}/api/admin/lookups?type=DELIVERY_ADDRESS` } },
          { name:"Get All Suppliers (Admin)", request:{ method:"GET", url:`${baseUrl}/api/admin/suppliers` } },
          { name:"Get All Requisitions (Admin)", request:{ method:"GET", url:`${baseUrl}/api/admin/requisitions?limit=100` } },
        ],
      },
      {
        name:"6. Bulk Upload (CSV)",
        item:[
          { name:"Upload Suppliers (JSON)", request:{ method:"POST", url:`${baseUrl}/api/upload/suppliers`, header:[{key:"Content-Type",value:"application/json"}], body:{ mode:"raw", raw:JSON.stringify({ rows:[{ name:"Test Supplier Ltd", category:"IT Hardware", contactEmail:"vendor@test.com", city:"Bengaluru", tier:"Tier 2", paymentTerms:"Net 30" }] }, null, 2) } } },
          { name:"Upload Lookups (JSON)", request:{ method:"POST", url:`${baseUrl}/api/upload/lookups`, header:[{key:"Content-Type",value:"application/json"}], body:{ mode:"raw", raw:JSON.stringify({ rows:[{ type:"DEPARTMENT", code:"TECH", label:"Technology", sortOrder:"10" }] }, null, 2) } } },
        ],
      },
    ],
  };

  return new NextResponse(JSON.stringify(collection, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": "attachment; filename="veltriance_api_collection.json"",
    },
  });
}
