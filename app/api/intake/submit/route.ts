import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RequisitionStatus, ApprovalStepType } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { generateRequisitionNumber } from "@/lib/requisition-number";
import { getApprovalSteps } from "@/lib/approval-matrix";
import { getCurrentOrganization } from "@/lib/tenant";

const submitSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative().default(0),
  supplierName: z.string().optional(),
  deliveryLocation: z.string().optional(),
  costCenter: z.string().optional(),
  requiredDate: z.string().optional(),
  currency: z.string().default("USD"),
  intakeSource: z.enum(["FORM", "CHATBOT"]).default("FORM"),
});

export async function POST(req: NextRequest) {
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
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const d = parsed.data;
  const lineTotal = d.quantity * d.unitPrice;
  const requisitionNumber = await generateRequisitionNumber(organization.id);

  // Try to match an existing supplier by name, scoped to this organization only.
  let supplierId: string | undefined;
  if (d.supplierName) {
    const match = await prisma.supplier.findFirst({
      where: { organizationId: organization.id, name: { equals: d.supplierName, mode: "insensitive" }, status: "ACTIVE" },
    });
    supplierId = match?.id;
  }

  const approvalStepTypes = getApprovalSteps(lineTotal);
  const STATUS_FOR_STEP: Record<ApprovalStepType, RequisitionStatus> = {
    [ApprovalStepType.MANAGER]: RequisitionStatus.MANAGER_APPROVAL,
    [ApprovalStepType.DIRECTOR]: RequisitionStatus.DIRECTOR_APPROVAL,
    [ApprovalStepType.PROCUREMENT]: RequisitionStatus.PROCUREMENT_REVIEW,
    [ApprovalStepType.FINANCE]: RequisitionStatus.FINANCE_APPROVAL,
  };
  const initialStatus = STATUS_FOR_STEP[approvalStepTypes[0]];

  const requisition = await prisma.requisition.create({
    data: {
      organizationId: organization.id,
      requisitionNumber,
      title: d.title,
      description: d.description,
      category: d.category,
      status: initialStatus,
      intakeSource: d.intakeSource,
      requestorId: profile.id,
      costCenter: d.costCenter ?? profile.costCenter,
      deliveryLocation: d.deliveryLocation,
      requiredDate: d.requiredDate ? new Date(d.requiredDate) : null,
      currency: d.currency,
      totalAmount: lineTotal,
      submittedAt: new Date(),
      lineItems: {
        create: [
          {
            description: d.title,
            quantity: d.quantity,
            unitPrice: d.unitPrice,
            lineTotal,
            supplierId,
          },
        ],
      },
      approvalSteps: {
        create: approvalStepTypes.map((stepType, i) => ({
          stepType,
          sequence: i + 1,
          // Manager approver defaults to the requestor's manager when present;
          // procurement/finance/director steps are claimed by anyone with that
          // role at approval time (see /api/requisitions/[id]/approve).
          approverId: stepType === "MANAGER" ? profile.managerId : null,
        })),
      },
    },
    include: { lineItems: true, approvalSteps: true },
  });

  return NextResponse.json({ requisition }, { status: 201 });
}
