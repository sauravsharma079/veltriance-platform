import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

async function authenticate(req: NextRequest): Promise<{ organizationId:string; scopes:string[] }|null> {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const hash  = crypto.createHash("sha256").update(token).digest("hex");
  try {
    const t = await (prisma.apiToken.findFirst as any)({ where: { token: hash, expiresAt: { gt: new Date() } } });
    if (t) return { organizationId: t.organizationId, scopes: t.scopes };
  } catch {}
  // Fallback: check if token matches any client secret directly
  const clients = await prisma.apiClient.findMany({ where: { active: true } });
  for (const c of clients) {
    const cc = c as any;
    if ((cc.clientSecretHash && cc.clientSecretHash === hash) ||
        (cc.clientSecret && cc.clientSecret === token)) {
      return { organizationId: cc.organizationId, scopes: cc.scopes || [] };
    }
  }
  return null;
}

function err(msg:string, status=400) { return NextResponse.json({ error:msg }, { status }); }

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth) return err("Unauthorized", 401);
  if (!auth.scopes.includes("requisitions:read")) return err("Forbidden: requires requisitions:read scope", 403);
  try {
    const { searchParams: sp } = req.nextUrl;
    const status   = sp.get("status")   || undefined;
    const priority = sp.get("priority") || undefined;
    const offset   = parseInt(sp.get("offset") || "0");
    const limit    = Math.min(parseInt(sp.get("limit") || "50"), 200);
    const [data, total] = await Promise.all([
      prisma.requisition.findMany({
        where: { organizationId: auth.organizationId, ...(status?{status:status as any}:{}), ...(priority?{priority:priority as any}:{}) },
        orderBy: { createdAt: "desc" }, skip: offset, take: limit,
        include: { requestor: { select: { name:true, email:true } }, lineItems: { select: { description:true, quantity:true, unitPrice:true, glAccount:true } } },
      }),
      prisma.requisition.count({ where: { organizationId: auth.organizationId, ...(status?{status:status as any}:{}) } }),
    ]);
    return NextResponse.json({ data, pagination: { total, offset, limit } });
  } catch (e:any) { return err(e.message, 500); }
}
