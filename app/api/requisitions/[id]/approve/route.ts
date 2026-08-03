import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RequisitionStatus, Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { canActOnStep, STATUS_FOR_STEP } from "@/lib/approval-matrix";
import { getCurrentOrganization } from "@/lib/tenant";
import { generatePONumber } from "@/lib/po-number";
import { sendPurchaseOrder } from "@/lib/po-send";
import { logAudit } from "@/lib/audit";

const actionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  comment: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !organization || profile.organizationId !== organization.id) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const requisition = await prisma.requisition.findUnique({
    where: { id },
    include: { approvalSteps: { orderBy: { sequence: "asc" } } },
  });
  if (!requisition || requisition.organizationId !== organization.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Steps sharing the same sequence number are a parallel group (see
  // ApprovalStep.approverMode in schema.prisma). "Current" is the lowest sequence
  // that still has anything pending.
  const pendingSteps = requisition.approvalSteps.filter((s) => s.status === "PENDING");
  if (pendingSteps.length === 0) {
    return NextResponse.json({ error: "No pending approval step on this requisition" }, { status: 400 });
  }
  const currentSequence = Math.min(...pendingSteps.map((s) => s.sequence));
  const currentGroup = pendingSteps.filter((s) => s.sequence === currentSequence);

  const myStep = currentGroup.find((s) => canActOnStep(s, profile));
  if (!myStep) {
    return NextResponse.json({ error: "You're not authorized to act on this approval step" }, { status: 403 });
  }

  if (parsed.data.decision === "REJECT") {
    // A reject always kills the requisition, regardless of ANY/ALL mode — a single
    // veto is meaningful either way.
    await prisma.$transaction([
      prisma.approvalStep.update({
        where: { id: myStep.id },
        data: { status: "REJECTED", comment: parsed.data.comment, decidedAt: new Date(), approverId: profile.id },
      }),
      prisma.approvalStep.updateMany({
        where: { requisitionId: id, status: "PENDING" },
        data: { status: "SKIPPED" },
      }),
      prisma.requisition.update({ where: { id }, data: { status: "REJECTED" } }),
    ]);
    await logAudit({
      organizationId: organization.id, userId: profile.id, userName: profile.name,
      action: "REJECTED", entity: "REQUISITION", entityId: id, entityLabel: requisition.requisitionNumber,
      details: { comment: parsed.data.comment },
    });
    return NextResponse.json({ status: "REJECTED" });
  }

  const otherPendingInGroup = currentGroup.filter((s) => s.id !== myStep.id);

  if (myStep.approverMode === "ALL" && otherPendingInGroup.length > 0) {
    // ALL mode: record this approval but wait for the rest of the group before the
    // requisition's status moves on.
    await prisma.approvalStep.update({
      where: { id: myStep.id },
      data: { status: "APPROVED", comment: parsed.data.comment, decidedAt: new Date(), approverId: profile.id },
    });
    await logAudit({
      organizationId: organization.id, userId: profile.id, userName: profile.name,
      action: "APPROVED", entity: "REQUISITION", entityId: id, entityLabel: requisition.requisitionNumber,
      details: { comment: parsed.data.comment, step: myStep.stepType, waitingOn: otherPendingInGroup.length },
    });
    return NextResponse.json({ status: requisition.status, waitingOn: otherPendingInGroup.length });
  }

  // Either ANY mode (first response wins — approve this step and skip the rest of
  // the group) or the last outstanding ALL-mode approver. Either way this closes out
  // the current sequence, so figure out what's next.
  const nextGroup = requisition.approvalSteps.filter((s) => s.sequence === currentSequence + 1);
  const isFullyApproved = nextGroup.length === 0;
  const newStatus = isFullyApproved ? RequisitionStatus.APPROVED : STATUS_FOR_STEP[nextGroup[0].stepType];

  await prisma.$transaction([
    prisma.approvalStep.update({
      where: { id: myStep.id },
      data: { status: "APPROVED", comment: parsed.data.comment, decidedAt: new Date(), approverId: profile.id },
    }),
    ...(otherPendingInGroup.length > 0
      ? [prisma.approvalStep.updateMany({ where: { id: { in: otherPendingInGroup.map((s) => s.id) } }, data: { status: "SKIPPED" } })]
      : []),
    prisma.requisition.update({
      where: { id },
      data: { status: newStatus },
    }),
  ]);
  await logAudit({
    organizationId: organization.id, userId: profile.id, userName: profile.name,
    action: "APPROVED", entity: "REQUISITION", entityId: id, entityLabel: requisition.requisitionNumber,
    details: { comment: parsed.data.comment, step: myStep.stepType, fullyApproved: isFullyApproved },
  });

  // When fully approved, create the PO and transmit it to the supplier right
  // away — no manual "review the draft, then send" step. If transmission
  // can't complete (e.g. no supplier email on file), it's left as DRAFT so
  // procurement can fix that and send it manually from the PO page.
  if (isFullyApproved) {
    try {
      const fullReq = await prisma.requisition.findUnique({
        where: { id },
        include: {
          lineItems: {
            include: { supplier: { select: { contactEmail: true, paymentTerms: true, poTransmissionMethod: true, cxmlEndpoint: true } } },
          },
        },
      });
      if (fullReq) {
        const poNumber = await generatePONumber(organization.id);
        const primaryLine = fullReq.lineItems[0];
        const supplierId = primaryLine?.supplierId ?? undefined;
        const supplierEmail = primaryLine?.supplier?.contactEmail ?? undefined;
        const paymentTerms = primaryLine?.supplier?.paymentTerms ?? undefined;
        const routingMethod = primaryLine?.supplier?.poTransmissionMethod ?? "EMAIL";
        const cxmlEndpoint = primaryLine?.supplier?.cxmlEndpoint ?? undefined;

        const po = await prisma.purchaseOrder.create({
          data: {
            organizationId: organization.id,
            poNumber,
            requisitionId: id,
            supplierId,
            createdById: profile.id,
            currency: fullReq.currency,
            subtotal: fullReq.totalAmount,
            taxAmount: fullReq.taxAmount ?? 0,
            totalAmount: fullReq.totalAmount,
            deliveryAddress: fullReq.deliveryLocation,
            expectedDelivery: fullReq.requiredDate ?? undefined,
            chartOfAccountId: fullReq.chartOfAccountId ?? undefined,
            glCoding: (fullReq.glCoding as Prisma.InputJsonValue) ?? undefined,
            routingMethod,
            cxmlEndpoint,
            supplierEmail,
            paymentTerms,
            notes: fullReq.description ?? fullReq.businessJustification ?? undefined,
            lineItems: {
              create: fullReq.lineItems.map(li => {
                // Convert glCoding JSON → account string for the PO line item's glAccount field
                // e.g. { "1": "BA01", "2": "CC001", "3": "4500" } → "BA01 - CC001 - 4500"
                const glFromCoding = li.glCoding
                  ? Object.values(li.glCoding as Record<string, string>).join(" - ")
                  : null;
                return {
                  description: li.description,
                  quantity: li.quantity,
                  unitPrice: li.unitPrice,
                  lineTotal: li.lineTotal,
                  glAccount: glFromCoding ?? li.glAccount ?? undefined,
                  supplierId: li.supplierId ?? undefined,
                };
              }),
            },
          },
        });
        await logAudit({
          organizationId: organization.id, userId: profile.id, userName: profile.name,
          action: "CREATED", entity: "PURCHASE_ORDER", entityId: po.id, entityLabel: po.poNumber,
          details: { fromRequisition: requisition.requisitionNumber, routingMethod },
        });

        if (supplierId) {
          const sendResult = await sendPurchaseOrder({
            poId: po.id, organizationId: organization.id, supabase,
            actorName: "Veltriance (auto-sent on approval)",
          });
          if ("error" in sendResult) {
            console.error("[approve] PO auto-send failed, left as DRAFT:", sendResult.error);
          }
        }
        // No supplier resolved at all — nothing to send to yet; PO stays DRAFT
        // until procurement assigns a supplier and sends it manually.
      }
    } catch (poErr) {
      // Log but don't fail the approval — the requisition is approved regardless
      console.error("[approve] PO auto-creation failed:", poErr);
    }
  }

  return NextResponse.json({ status: newStatus });
}
