import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiRequest } from "@/lib/api-auth";

function err(msg:string, status=400) { return NextResponse.json({ error:msg }, { status }); }

export async function GET(req: NextRequest) {
  const v = await validateApiRequest(req, "requisitions:read");
  if ("error" in v) return err(v.error, v.status);
  const auth = v.ctx;
  try {
    const { searchParams: sp } = req.nextUrl;
    const status   = sp.get("status")   || undefined;
    const priority = sp.get("priority") || undefined;
    const offset   = Math.max(parseInt(sp.get("offset") || "0") || 0, 0);
    const limit    = Math.min(Math.max(parseInt(sp.get("limit") || "50") || 50, 1), 200);
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
