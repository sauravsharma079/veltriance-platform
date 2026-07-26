import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiRequest, apiOk, apiErr, parsePagination, pagMeta } from "@/lib/api-auth";
export async function GET(req: NextRequest) {
  const a = await validateApiRequest(req, "suppliers:read");
  if ("error" in a) return apiErr(a.error, a.status);
  const { offset, limit } = parsePagination(req); const u = new URL(req.url);
  const w: Record<string,unknown> = { organizationId: a.ctx.organizationId };
  const s=u.searchParams.get("status"); const c=u.searchParams.get("category"); const q=u.searchParams.get("q");
  if(s) w.status=s.toUpperCase(); if(c) w.category={contains:c,mode:"insensitive"}; if(q) w.name={contains:q,mode:"insensitive"};
  const [total,data] = await Promise.all([prisma.supplier.count({where:w}), prisma.supplier.findMany({where:w,orderBy:{name:"asc"},skip:offset,take:limit})]);
  return apiOk(data, pagMeta(total, offset, limit, "/api/v1/suppliers"));
}
export async function POST(req: NextRequest) {
  const a = await validateApiRequest(req, "suppliers:write");
  if ("error" in a) return apiErr(a.error, a.status);
  let b: Record<string,unknown>; try { b = await req.json(); } catch { return apiErr("Invalid JSON",400); }
  if (!b.name) return apiErr("name required",422); if (!b.contact_email) return apiErr("contact_email required",422);
  const d = await prisma.supplier.create({ data:{ organizationId:a.ctx.organizationId, name:b.name as string, contactEmail:b.contact_email as string, contactName:b.contact_name as string|undefined, category:b.category as string|undefined, currency:(b.currency as string|undefined)??"USD", status:"PENDING_APPROVAL" } });
  return Response.json({ data:d }, { status:201 });
}
