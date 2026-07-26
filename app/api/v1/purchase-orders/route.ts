import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiRequest, apiOk, apiErr, parsePagination, pagMeta } from "@/lib/api-auth";
export async function GET(req: NextRequest) {
  const a = await validateApiRequest(req, "purchase_orders:read");
  if ("error" in a) return apiErr(a.error, a.status);
  const { offset, limit } = parsePagination(req); const u = new URL(req.url);
  const w: Record<string,unknown> = { organizationId: a.ctx.organizationId };
  const s = u.searchParams.get("status"); const sp = u.searchParams.get("supplier_id");
  if (s) w.status = s.toUpperCase(); if (sp) w.supplierId = sp;
  const [total, data] = await Promise.all([
    prisma.purchaseOrder.count({ where: w }),
    prisma.purchaseOrder.findMany({ where: w, orderBy:{createdAt:"desc"}, skip:offset, take:limit, include:{supplier:{select:{id:true,name:true,code:true}},createdBy:{select:{id:true,name:true}},lineItems:true} }),
  ]);
  return apiOk(data, pagMeta(total, offset, limit, "/api/v1/purchase-orders"));
}
