import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invoiceAccess } from "@/lib/invoice-access";
import { invoiceApprovalVerdict } from "@/lib/invoicing";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await invoiceAccess();
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, organizationId: a.org.id },
    include: { lines: true, supplier: { select: { id: true, name: true, status: true } }, purchaseOrder: { select: { id: true, poNumber: true, status: true } }, createdBy: { select: { name: true } } },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const verdict = await invoiceApprovalVerdict({ organizationId: a.org.id, creatorId: invoice.createdById, approver: a.profile });
  return NextResponse.json({
    invoice,
    me: { id: a.profile.id, role: a.profile.role },
    canApprove: verdict.allowed, selfApproval: verdict.allowed ? verdict.selfApproval : false, approveBlockedReason: verdict.allowed === false ? verdict.reason : null,
  });
}
