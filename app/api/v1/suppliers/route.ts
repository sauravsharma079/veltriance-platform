import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

async function auth(req: NextRequest): Promise<{ organizationId:string; scopes:string[] }|null> {
  const h = req.headers.get("authorization")||"";
  if (!h.startsWith("Bearer ")) return null;
  const tok = h.slice(7);
  const hash = crypto.createHash("sha256").update(tok).digest("hex");
  try {
    const t = await (prisma.apiToken.findFirst as any)({ where:{ token:hash, expiresAt:{gt:new Date()} } });
    if(t) return { organizationId:t.organizationId, scopes:t.scopes };
  } catch {}
  const clients = await prisma.apiClient.findMany({ where:{ active:true } });
  for(const c of clients) {
    const cc=c as any;
    if((cc.clientSecretHash&&cc.clientSecretHash===hash)||(cc.clientSecret&&cc.clientSecret===tok))
      return { organizationId:cc.organizationId, scopes:cc.scopes||[] };
  }
  return null;
}

export async function GET(req: NextRequest) {
  const a = await auth(req);
  if(!a) return NextResponse.json({ error:"Unauthorized" }, { status:401 });
  if(!a.scopes.includes("suppliers:read")) return NextResponse.json({ error:"Forbidden: requires suppliers:read" }, { status:403 });
  try {
    const { searchParams:sp } = req.nextUrl;
    const status = sp.get("status")||undefined;
    const offset = parseInt(sp.get("offset")||"0");
    const limit  = Math.min(parseInt(sp.get("limit")||"50"),200);
    const [data,total] = await Promise.all([
      prisma.supplier.findMany({ where:{ organizationId:a.organizationId, ...(status?{status:status as any}:{}) }, orderBy:{ name:"asc" }, skip:offset, take:limit }),
      prisma.supplier.count({ where:{ organizationId:a.organizationId, ...(status?{status:status as any}:{}) } }),
    ]);
    return NextResponse.json({ data, pagination:{ total,offset,limit } });
  } catch(e:any) { return NextResponse.json({ error:e.message }, { status:500 }); }
}
