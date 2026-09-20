import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canActOnStep } from "@/lib/approval-matrix";
import { verifyApprovalToken } from "@/lib/approval-notify";
import { activeDelegators } from "@/lib/approval-delegation";
import { decideStep } from "@/lib/requisition-approval";

/**
 * One-click approval from an email. Unauthenticated, but the token is signed, names a single approver
 * and approval stage, and expires. It only works while that exact stage is still open.
 */
async function load(token: string) {
  const link = verifyApprovalToken(token);
  if (!link) return null;
  const user = await prisma.user.findUnique({ where: { id: link.u }, select: { id: true, name: true, role: true, organizationId: true } });
  const req = await prisma.requisition.findFirst({
    where: { id: link.r, organizationId: user?.organizationId ?? "-" },
    include: { requestor: { select: { name: true } }, organization: { select: { name: true } }, approvalSteps: { orderBy: { sequence: "asc" } }, lineItems: { select: { description: true, quantity: true, unitPrice: true, lineTotal: true, supplier: { select: { name: true } } }, take: 15 } },
  });
  if (!user || !req) return null;
  const pending = req.approvalSteps.filter(s => s.status === "PENDING");
  const seq = pending.length ? Math.min(...pending.map(s => s.sequence)) : null;
  const group = seq === null ? [] : pending.filter(s => s.sequence === seq);
  const delegators = await activeDelegators(user.id);
  const mine = group.some(s => canActOnStep(s, user) || (s.approverId && delegators.includes(s.approverId)));
  const open = seq !== null && seq === link.g && mine;
  const reason = open ? null : seq === null ? `This request has already been ${req.status === "REJECTED" ? "rejected" : req.status === "CANCELLED" ? "cancelled" : "decided"}.` : seq !== link.g ? "This request has moved on to a later stage. Use the newer email, or open the app." : "You're no longer able to act on this step.";
  return { link, user, req, open, reason };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const d = await load((await ctx.params).token);
  if (!d) return NextResponse.json({ error: "This link isn't valid any more" }, { status: 404 });
  const { req, user } = d;
  return NextResponse.json({
    organization: req.organization.name, approver: user.name, canDecide: d.open, closedReason: d.reason,
    requisition: {
      number: req.requisitionNumber, title: req.title, requestor: req.requestor.name, amount: Number(req.totalAmount), currency: req.currency, status: req.status,
      category: req.category, department: req.department, justification: req.businessJustification, neededBy: req.requiredDate, deliveryLocation: req.deliveryLocation,
      policyException: req.policyException, policyExceptionNote: req.policyExceptionNote,
      lines: req.lineItems.map(l => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), total: Number(l.lineTotal), supplier: l.supplier?.name ?? null })),
    },
  });
}

const schema = z.object({ decision: z.enum(["APPROVE", "REJECT"]), comment: z.string().trim().max(1000).optional() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const d = await load((await ctx.params).token);
  if (!d) return NextResponse.json({ error: "This link isn't valid any more" }, { status: 404 });
  if (!d.open) return NextResponse.json({ error: d.reason }, { status: 409 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 422 });
  if (parsed.data.decision === "REJECT" && (parsed.data.comment ?? "").length < 3) return NextResponse.json({ error: "Please say why you're rejecting it" }, { status: 422 });
  const r = await decideStep({ organizationId: d.req.organizationId, requisitionId: d.req.id, actor: { id: d.user.id, name: d.user.name, role: d.user.role }, decision: parsed.data.decision, comment: parsed.data.comment, via: "email", origin: req.nextUrl.origin });
  return NextResponse.json(r.json, { status: r.status });
}
