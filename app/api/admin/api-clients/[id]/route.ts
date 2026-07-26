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

type P = { params: Promise<{id:string}> };

export async function PATCH(req: NextRequest, { params }: P) {
  const {id} = await params; const ctx = await admin();
  if (!ctx) return NextResponse.json({error:"Forbidden"},{status:403});
  const c = await prisma.apiClient.findFirst({where:{id,organizationId:ctx.organization.id}});
  if (!c) return NextResponse.json({error:"Not found"},{status:404});
  const b = await req.json();
  if (b.rotate_secret) {
    const sec = "vlt_secret_"+randomBytes(32).toString("hex");
    await prisma.apiToken.updateMany({where:{apiClientId:id,revokedAt:null},data:{revokedAt:new Date()}});
    await prisma.apiClient.update({where:{id},data:{clientSecretHash:createHash("sha256").update(sec).digest("hex")}});
    return NextResponse.json({client_secret:sec,_warning:"All tokens revoked."});
  }
  if (b.active!==undefined) {
    await prisma.apiClient.update({where:{id},data:{active:b.active}});
    if (!b.active) await prisma.apiToken.updateMany({where:{apiClientId:id,revokedAt:null},data:{revokedAt:new Date()}});
    return NextResponse.json({success:true});
  }
  if (b.scopes) { await prisma.apiClient.update({where:{id},data:{scopes:b.scopes}}); return NextResponse.json({success:true}); }
  return NextResponse.json({error:"Nothing to update"},{status:400});
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const {id} = await params; const ctx = await admin();
  if (!ctx) return NextResponse.json({error:"Forbidden"},{status:403});
  const c = await prisma.apiClient.findFirst({where:{id,organizationId:ctx.organization.id}});
  if (!c) return NextResponse.json({error:"Not found"},{status:404});
  await prisma.apiClient.delete({where:{id}});
  return NextResponse.json({success:true});
}
