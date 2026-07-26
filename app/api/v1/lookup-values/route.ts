import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiRequest, apiOk, apiErr, parsePagination, pagMeta } from "@/lib/api-auth";
export async function GET(req: NextRequest) {
  const a = await validateApiRequest(req, "lookup_values:read");
  if ("error" in a) return apiErr(a.error, a.status);
  const { offset, limit } = parsePagination(req); const u = new URL(req.url);
  const t=u.searchParams.get("type"); const ao=u.searchParams.get("active")!=="false";
  const w: Record<string,unknown> = { organizationId:a.ctx.organizationId };
  if(t) w.type=t.toUpperCase(); if(ao) w.active=true;
  const [total,data] = await Promise.all([prisma.lookup.count({where:w}), prisma.lookup.findMany({where:w,orderBy:[{type:"asc"},{sortOrder:"asc"}],skip:offset,take:limit})]);
  return apiOk(data, pagMeta(total, offset, limit, "/api/v1/lookup-values"));
}
