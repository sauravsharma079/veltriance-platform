import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RequisitionStatus, ApprovalStepType, RequisitionPriority, Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { generateRequisitionNumber } from "@/lib/requisition-number";
import { resolveApprovalSteps, STATUS_FOR_STEP } from "@/lib/approval-matrix";
import { logAudit } from "@/lib/audit";
import { getCurrentOrganization } from "@/lib/tenant";
import { parseRequiredDate } from "@/lib/date-phrase";

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  taxRate: z.coerce.number().nonnegative().default(0),
  supplierId: z.string().optional(),
  partNumber: z.string().optional(),
  category: z.string().optional(),
  commodity: z.string().optional(),
  glAccount: z.string().optional(),
  costCenter: z.string().optional(),
  contractReference: z.string().optional(),
  notes: z.string().optional(),
  glCoaId: z.string().optional(),
  glCoding: z.record(z.string(), z.string()).optional(),
});

const submitSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
  commodity: z.string().optional(),
  priority: z.nativeEnum(RequisitionPriority).default("MEDIUM"),
  businessUnit: z.string().optional(),
  department: z.string().optional(),
  project: z.string().optional(),
  budget: z.coerce.number().nonnegative().optional(),
  costCenter: z.string().optional(),
  deliveryLocation: z.string().optional(),
  requiredDate: z.string().optional(),
  currency: z.string().default("USD"),
  businessJustification: z.string().optional(),
  policyException: z.boolean().default(false),
  policyExceptionNote: z.string().optional(),
  intakeSource: z.enum(["FORM", "CHATBOT"]).default("FORM"),
  chartOfAccountId: z.string().optional(),
  glCoding: z.record(z.string(), z.string()).optional(),
  customFieldAnswers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  lineItems: z.array(lineItemSchema).optional(),
  // Legacy single-item fields (from chatbot)
  quantity: z.coerce.number().positive().optional(),
  unitPrice: z.coerce.number().nonnegative().optional(),
  supplierName: z.string().optional(),
}).refine(d => (d.lineItems && d.lineItems.length > 0) || d.quantity !== undefined, {
  message: "Either lineItems or quantity must be provided",
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [profile, organization] = await Promise.all([
      prisma.user.findUnique({ where: { authId: user.id } }),
      getCurrentOrganization(),
    ]);
    if (!profile || !organization || profile.organizationId !== organization.id)
      return NextResponse.json({ error: "Profile not found — are you signed in to the right workspace?" }, { status: 404 });

    const body = await req.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstError = Object.entries(fieldErrors).map(([k, v]) => `${k}: ${v?.[0]}`).join(", ");
      return NextResponse.json({ error: firstError || "Validation failed" }, { status: 422 });
    }

    const d = parsed.data;

    // Normalise: if the caller sent legacy single-item fields (chatbot), wrap them
    let lineItems = d.lineItems;
    if (!lineItems?.length && d.quantity !== undefined) {
      let supplierId: string | undefined;
      if (d.supplierName) {
        const match = await prisma.supplier.findFirst({
          where: { organizationId: organization.id, name: { equals: d.supplierName, mode: "insensitive" }, status: "ACTIVE" },
        });
        supplierId = match?.id;
      }
      lineItems = [{
        description: d.title,
        quantity: d.quantity!,
        unitPrice: d.unitPrice ?? 0,
        taxRate: 0,
        supplierId,
        // Chatbot intake collects GL coding/cost center once at the header level —
        // carry it down onto the line item too, since that's where the requisition
        // and PO templates display it (billing-level display was a real gap: the
        // header had the coding but every line item showed "—").
        costCenter: d.costCenter,
        glCoaId: d.chartOfAccountId,
        glCoding: d.glCoding,
      }];
    }

    // Calculate totals
    const lineItemsWithTotals = lineItems.map(li => {
      const lineTotal = li.quantity * li.unitPrice;
      const taxAmount = lineTotal * (li.taxRate ?? 0);
      return { ...li, lineTotal, taxAmount };
    });
    const subtotal = lineItemsWithTotals.reduce((s, li) => s + li.lineTotal, 0);
    const totalTax = lineItemsWithTotals.reduce((s, li) => s + li.taxAmount, 0);
    const totalAmount = subtotal + totalTax;

    const requisitionNumber = await generateRequisitionNumber(organization.id);

    // Duplicate detection — warn if same title submitted in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const potentialDupe = await prisma.requisition.findFirst({
      where: {
        organizationId: organization.id,
        requestorId: profile.id,
        title: { equals: d.title, mode: "insensitive" },
        createdAt: { gte: sevenDaysAgo },
        status: { notIn: ["REJECTED", "CANCELLED"] },
      },
      select: { requisitionNumber: true },
    });

    const approvalSteps = await resolveApprovalSteps(
      organization.id, totalAmount, d.category, d.department ?? profile.department
    );
    const initialStatus = approvalSteps.length > 0
      ? STATUS_FOR_STEP[approvalSteps[0].stepType]
      : RequisitionStatus.APPROVED;

    const requisition = await prisma.requisition.create({
      data: {
        organizationId: organization.id,
        requisitionNumber,
        title: d.title,
        description: d.description,
        category: d.category,
        commodity: d.commodity,
        priority: d.priority,
        status: initialStatus,
        intakeSource: d.intakeSource,
        requestorId: profile.id,
        businessUnit: d.businessUnit ?? profile.businessUnit,
        department: d.department ?? profile.department,
        project: d.project,
        budget: d.budget,
        costCenter: d.costCenter ?? profile.costCenter,
        deliveryLocation: d.deliveryLocation,
        requiredDate: parseRequiredDate(d.requiredDate),
        currency: d.currency,
        totalAmount,
        taxAmount: totalTax,
        businessJustification: d.businessJustification,
        policyException: d.policyException,
        policyExceptionNote: d.policyExceptionNote,
        chartOfAccountId: d.chartOfAccountId,
        glCoding: d.glCoding as Prisma.InputJsonValue | undefined,
        customFieldAnswers: d.customFieldAnswers as Prisma.InputJsonValue | undefined,
        submittedAt: new Date(),
        lineItems: {
          create: lineItemsWithTotals.map(li => ({
            description: li.description,
            partNumber: li.partNumber,
            category: li.category,
            commodity: li.commodity,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            lineTotal: li.lineTotal,
            taxRate: li.taxRate ?? 0,
            taxAmount: li.taxAmount,
            glAccount: li.glAccount,
            costCenter: li.costCenter,
            contractReference: li.contractReference,
            notes: li.notes,
            glCoaId: li.glCoaId,
            glCoding: li.glCoding,
            supplierId: li.supplierId,
          })),
        },
        approvalSteps: {
          // A step with approverUserIds becomes a parallel group: multiple ApprovalStep
          // rows sharing the same sequence number, one per named approver. See
          // ApprovalStep.approverMode in schema.prisma for how the group resolves.
          create: approvalSteps.flatMap((step, i) => {
            const sequence = i + 1;
            if (step.approverUserIds.length > 0) {
              return step.approverUserIds.map(uid => ({
                stepType: step.stepType, stepLabel: step.stepLabel, sequence,
                approverId: uid, approverMode: step.approverMode,
              }));
            }
            return [{
              stepType: step.stepType, stepLabel: step.stepLabel, sequence,
              approverId: step.stepType === ApprovalStepType.MANAGER
                ? (step.assignedUserId ?? profile.managerId)
                : step.assignedUserId,
              approverMode: step.approverMode,
            }];
          }),
        },
      },
      include: { lineItems: true, approvalSteps: true },
    });

    return NextResponse.json({
      requisition,
      warning: potentialDupe
        ? `A similar request (${potentialDupe.requisitionNumber}) was already submitted this week. Please check if this is a duplicate.`
        : null,
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[intake/submit]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
