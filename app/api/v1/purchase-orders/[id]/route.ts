import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiRequest, apiOk, apiErr } from "@/lib/api-auth";
type P = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, { params }: P) {
  const { id } = await params; const a = await validateApiRequest(req, "purchase_orders:read");
  if ("error" in a) return apiErr(a.error, a.status);
  const d = await prisma.purchaseOrder.findFirst({ where:{id,organizationId:a.ctx.organizationId}, include:{supplier:true,createdBy:{select:{id:true,name:true}},lineItems:true,requisition:{select:{id:true,requisitionNumber:true,title:true}}} });
  if (!d) return apiErr("Not found", 404); return apiOk(d);
}
export async function PATCH(req: NextRequest, { params }: P) {
  const { id } = await params; const a = await validateApiRequest(req, "purchase_orders:write");
  if ("error" in a) return apiErr(a.error, a.status);
  const e = await prisma.purchaseOrder.findFirst({ where:{id,organizationId:a.ctx.organizationId} });
  if (!e) return apiErr("Not found", 404);
  let b: Record<string,unknown>; try { b = await req.json(); } catch { return apiErr("Invalid JSON", 400); }
  const T: Record<string,string[]> = { DRAFT:["SENT","CANCELLED"], SENT:["ACKNOWLEDGED","CANCELLED"], ACKNOWLEDGED:["PARTIALLY_RECEIVED","RECEIVED","CANCELLED"], PARTIALLY_RECEIVED:["RECEIVED","CANCELLED"], RECEIVED:["CLOSED"] };
  const u: Record<string,unknown> = {};
  if (b.status) { const al = T[e.status]??[]; if (!al.includes(b.status as string)) return apiErr(`Cannot transition ${e.status}→${b.status}. Allowed: ${al.join(", ")}`,422); u.status=b.status; if(b.status==="SENT") u.issuedAt=new Date(); if(b.status==="ACKNOWLEDGED") u.acknowledgedAt=new Date(); }
  if (b.supplier_email) u.supplierEmail=b.supplier_email; if (b.notes) u.notes=b.notes; if (b.payment_terms) u.paymentTerms=b.payment_terms;
  const d = await prisma.purchaseOrder.update({ where:{id}, data:{...u,updatedAt:new Date()}, select:{id:true,poNumber:true,status:true,updatedAt:true} });
  return apiOk(d);
}
