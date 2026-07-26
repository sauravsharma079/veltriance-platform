import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiRequest, apiOk, apiErr } from "@/lib/api-auth";
type P = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, { params }: P) {
  const { id } = await params; const a = await validateApiRequest(req, "suppliers:read");
  if ("error" in a) return apiErr(a.error, a.status);
  const d = await prisma.supplier.findFirst({ where:{id,organizationId:a.ctx.organizationId}, include:{contacts:true} });
  if (!d) return apiErr("Not found",404); return apiOk(d);
}
export async function PATCH(req: NextRequest, { params }: P) {
  const { id } = await params; const a = await validateApiRequest(req, "suppliers:write");
  if ("error" in a) return apiErr(a.error, a.status);
  const e = await prisma.supplier.findFirst({ where:{id,organizationId:a.ctx.organizationId} });
  if (!e) return apiErr("Not found",404);
  let b: Record<string,unknown>; try { b = await req.json(); } catch { return apiErr("Invalid JSON",400); }
  const map: Record<string,string> = {name:"name",contact_email:"contactEmail",contact_name:"contactName",contact_phone:"contactPhone",website:"website",category:"category",payment_terms:"paymentTerms",tier:"tier",city:"city",country:"country"};
  const u: Record<string,unknown> = {};
  for (const [k,v] of Object.entries(map)) if (b[k]!==undefined) u[v]=b[k];
  if (b.status!==undefined) u.status=(b.status as string).toUpperCase();
  if (b.preferred!==undefined) u.preferred=Boolean(b.preferred);
  const d = await prisma.supplier.update({ where:{id}, data:{...u,updatedAt:new Date()} });
  return apiOk(d);
}
