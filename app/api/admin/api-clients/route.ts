import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { randomBytes, createHash } from "crypto";

async function admin() {
  const sb = await createClient();
  const { data:{user} } = await sb.auth.getUser();
  if (!user) return null;
  const [p, o] = await Promise.all([prisma.user.findUnique({where:{authId:user.id}}), getCurrentOrganization()]);
  if (!p||!o||p.organizationId!==o.id||p.role!=="ADMIN") return null;
  return { profile:p, organization:o };
}

export const SCOPES = ["requisitions:read","requisitions:write","purchase_orders:read","purchase_orders:write","suppliers:read","suppliers:write","lookup_values:read","users:read","admin:read"];

export async function GET() {
  const ctx = await admin(); if (!ctx) return NextResponse.json({error:"Forbidden"},{status:403});
  const clients = await prisma.apiClient.findMany({ where:{organizationId:ctx.organization.id}, orderBy:{createdAt:"desc"}, select:{id:true,name:true,description:true,clientId:true,scopes:true,active:true,lastUsedAt:true,createdAt:true,_count:{select:{tokens:true}}} });
  return NextResponse.json({ clients, availableScopes: SCOPES });
}

export async function POST(req: NextRequest) {
  const ctx = await admin(); if (!ctx) return NextResponse.json({error:"Forbidden"},{status:403});
  const { name, description, scopes } = await req.json();
  if (!name) return NextResponse.json({error:"name required"},{status:422});
  if (!scopes?.length) return NextResponse.json({error:"scopes required"},{status:422});
  const bad = scopes.filter((s: string) => !SCOPES.includes(s));
  if (bad.length) return NextResponse.json({error:`Invalid scopes: ${bad.join(", ")}`},{status:422});
  const cid = "vlt_client_"+randomBytes(16).toString("hex");
  const sec = "vlt_secret_"+randomBytes(32).toString("hex");
  const c = await prisma.apiClient.create({ data:{ organizationId:ctx.organization.id, name, description, clientId:cid, clientSecretHash:createHash("sha256").update(sec).digest("hex"), scopes, active:true } });
  return NextResponse.json({ id:c.id, name:c.name, client_id:cid, client_secret:sec, scopes:c.scopes, _warning:"Store client_secret securely — not shown again." }, {status:201});
}
