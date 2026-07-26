import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiRequest, apiOk, apiErr, parsePagination, pagMeta } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const a = await validateApiRequest(req, "requisitions:read");
  if ("error" in a) return apiErr(a.error, a.status);
  const { offset, limit } = parsePagination(req);
  const u = new URL(req.url);
  const w: Record<string, unknown> = { organizationId: a.ctx.organizationId };
  const s = u.searchParams.get("status"); const p = u.searchParams.get("priority"); const c = u.searchParams.get("category");
  if (s) w.status = s.toUpperCase(); if (p) w.priority = p.toUpperCase(); if (c) w.category = { contains: c, mode: "insensitive" };
  const [total, data] = await Promise.all([
    prisma.requisition.count({ where: w }),
    prisma.requisition.findMany({ where: w, orderBy: { createdAt: "desc" }, skip: offset, take: limit, include: { requestor: { select: { id:true,name:true,email:true } }, lineItems: true } }),
  ]);
  return apiOk(data, pagMeta(total, offset, limit, "/api/v1/requisitions"));
}

export async function POST(req: NextRequest) {
  const a = await validateApiRequest(req, "requisitions:write");
  if ("error" in a) return apiErr(a.error, a.status);
  let b: Record<string, unknown>; try { b = await req.json(); } catch { return apiErr("Invalid JSON", 400); }
  if (!b.title) return apiErr("title required", 422);
  if (!b.requestor_id) return apiErr("requestor_id required", 422);
  const r = await prisma.user.findFirst({ where: { id: b.requestor_id as string, organizationId: a.ctx.organizationId } });
  if (!r) return apiErr("requestor_id not found", 422);
  const n = await prisma.requisition.count({ where: { organizationId: a.ctx.organizationId } });
  const d = await prisma.requisition.create({ data: { organizationId: a.ctx.organizationId, requisitionNumber: `REQ-${String(n+1).padStart(6,"0")}`, title: b.title as string, description: b.description as string|undefined, category: b.category as string|undefined, priority: ((b.priority as string|undefined)?.toUpperCase() ?? "MEDIUM") as "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", status: "DRAFT", intakeSource: "FORM", requestorId: r.id, currency: (b.currency as string|undefined) ?? "USD" } });
  return Response.json({ data: d }, { status: 201 });
}
