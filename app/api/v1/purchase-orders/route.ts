import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const v = await validateApiRequest(req, "purchase_orders:read");
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: v.status });
  const a = v.ctx;
  try {
    const { searchParams:sp } = req.nextUrl;
    const status = sp.get("status")||undefined;
    const offset = Math.max(parseInt(sp.get("offset")||"0")||0,0);
    const limit  = Math.min(Math.max(parseInt(sp.get("limit")||"50")||50,1),200);
    const [data,total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where:{ organizationId:a.organizationId, ...(status?{status:status as any}:{}) },
        orderBy:{ createdAt:"desc" }, skip:offset, take:limit,
        include:{ supplier:{ select:{name:true,code:true} }, lineItems:true },
      }),
      prisma.purchaseOrder.count({ where:{ organizationId:a.organizationId } }),
    ]);
    return NextResponse.json({ data, pagination:{ total,offset,limit } });
  } catch(e:any) { return NextResponse.json({ error:e.message }, { status:500 }); }
}
