import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiRequest, apiOk, apiErr } from "@/lib/api-auth";
type P = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, { params }: P) {
  const { id } = await params; const a = await validateApiRequest(req, "requisitions:read");
  if ("error" in a) return apiErr(a.error, a.status);
  const d = await prisma.requisition.findFirst({ where: { id, organizationId: a.ctx.organizationId }, include: { requestor: { select:{id:true,name:true,email:true} }, lineItems: { include: { supplier: { select:{id:true,name:true} } } }, approvalSteps: { orderBy:{sequence:"asc"}, include:{approver:{select:{id:true,name:true,email:true}}} } } });
  if (!d) return apiErr("Not found", 404); return apiOk(d);
}
export async function PATCH(req: NextRequest, { params }: P) {
  const { id } = await params; const a = await validateApiRequest(req, "requisitions:write");
  if ("error" in a) return apiErr(a.error, a.status);
  const e = await prisma.requisition.findFirst({ where: { id, organizationId: a.ctx.organizationId } });
  if (!e) return apiErr("Not found", 404);
  let b: Record<string, unknown>; try { b = await req.json(); } catch { return apiErr("Invalid JSON", 400); }
  const u: Record<string, unknown> = {};
  if (b.status === "SUBMITTED" && e.status === "DRAFT") { u.status = "SUBMITTED"; u.submittedAt = new Date(); }
  else if (b.status === "CANCELLED") { u.status = "CANCELLED"; }
  else if (e.status === "DRAFT") { if (b.title) u.title = b.title; if (b.category) u.category = b.category; if (b.priority) u.priority = (b.priority as string).toUpperCase(); }
  else return apiErr(`Cannot update status ${e.status}`, 422);
  const d = await prisma.requisition.update({ where:{id}, data:u, select:{id:true,requisitionNumber:true,status:true,updatedAt:true} });
  return apiOk(d);
}
