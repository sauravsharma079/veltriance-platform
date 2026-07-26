
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

async function getCtx() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const [profile, org] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !org || profile.organizationId !== org.id) return null;
  return { profile, org };
}

// POST /api/procurement/orchestrate
// action: search_suppliers | create_requisition | get_status | approve | create_po | get_pending
export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  try {
    switch (action) {

      case "search_suppliers": {
        const { query, category } = body;
        const where: Record<string, unknown> = {
          organizationId: ctx.org.id,
          status: "ACTIVE",
        };
        if (query || category) {
          where.OR = [
            query    ? { name:     { contains: query ?? category, mode: "insensitive" } } : undefined,
            category ? { category: { contains: category,          mode: "insensitive" } } : undefined,
          ].filter(Boolean);
        }
        const suppliers = await prisma.supplier.findMany({
          where, take: 6, orderBy: { preferred: "desc" },
          select: { id: true, name: true, code: true, category: true, tier: true, preferred: true, rating: true, contactEmail: true },
        });
        return NextResponse.json({ suppliers });
      }

      case "create_requisition": {
        const { title, category, priority, department, justification, required_date, line_items } = body;
        if (!title || !line_items?.length) {
          return NextResponse.json({ error: "title and line_items required" }, { status: 422 });
        }
        const count  = await prisma.requisition.count({ where: { organizationId: ctx.org.id } });
        const reqNum = `REQ-${String(count + 1).padStart(6, "0")}`;
        const subtotal = (line_items as { quantity: number; unit_price: number }[]).reduce(
          (s: number, l: { quantity: number; unit_price: number }) => s + l.quantity * l.unit_price, 0
        );
        const tax   = subtotal * 0.18;
        const total = subtotal + tax;

        const req = await prisma.requisition.create({
          data: {
            organizationId:  ctx.org.id,
            requestorId:     ctx.profile.id,
            requisitionNumber: reqNum,
            title,
            category:        category || null,
            priority:        (priority || "MEDIUM") as "LOW"|"MEDIUM"|"HIGH"|"CRITICAL",
            status:          "SUBMITTED",
            intakeSource:    "CHATBOT",
            department:      department || null,
            currency:        "INR",
            totalAmount:     subtotal,
            taxAmount:       tax,
            businessJustification: justification || null,
            requiredDate:    required_date ? new Date(required_date) : null,
            submittedAt:     new Date(),
            lineItems: {
              create: (line_items as { description: string; quantity: number; unit_price: number; supplier_id?: string }[]).map(
                (l: { description: string; quantity: number; unit_price: number; supplier_id?: string }) => ({
                  description: l.description,
                  quantity:    l.quantity,
                  unitPrice:   l.unit_price,
                  lineTotal:   l.quantity * l.unit_price,
                  taxRate:     0.18,
                  taxAmount:   l.quantity * l.unit_price * 0.18,
                  supplierId:  l.supplier_id || null,
                })
              ),
            },
          },
          include: { lineItems: true },
        });

        // Auto-create approval step
        await prisma.approvalStep.create({
          data: { requisitionId: req.id, stepType: "MANAGER", sequence: 1, status: "PENDING" },
        });

        return NextResponse.json({
          success: true,
          requisition_number: reqNum,
          id: req.id,
          status: "SUBMITTED",
          subtotal, tax, total,
          line_count: req.lineItems.length,
        });
      }

      case "get_pending": {
        const reqs = await prisma.requisition.findMany({
          where: {
            organizationId: ctx.org.id,
            status: { in: ["SUBMITTED","MANAGER_APPROVAL","FINANCE_APPROVAL","PROCUREMENT_REVIEW"] },
          },
          orderBy: { submittedAt: "desc" }, take: 10,
          include: { requestor: { select: { name: true } } },
        });
        return NextResponse.json({ requisitions: reqs.map(r => ({
          id: r.id, number: r.requisitionNumber, title: r.title,
          status: r.status, priority: r.priority,
          total: r.totalAmount, requestor: r.requestor.name,
        }))});
      }

      case "get_status": {
        const { identifier } = body;
        const req = await prisma.requisition.findFirst({
          where: {
            organizationId: ctx.org.id,
            OR: [{ id: identifier }, { requisitionNumber: identifier }],
          },
          include: {
            requestor:     { select: { name: true } },
            lineItems:     { include: { supplier: { select: { name: true } } } },
            approvalSteps: { orderBy: { sequence: "asc" }, include: { approver: { select: { name: true } } } },
            purchaseOrder: { select: { poNumber: true, status: true } },
          },
        });
        if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({
          id: req.id, number: req.requisitionNumber, title: req.title,
          status: req.status, priority: req.priority,
          total: req.totalAmount, currency: req.currency,
          requestor: req.requestor.name,
          steps: req.approvalSteps.map(s => ({
            sequence: s.sequence, type: s.stepType, status: s.status,
            approver: s.approver?.name || "Pending assignment", comment: s.comment,
          })),
          items: req.lineItems.map(l => ({
            description: l.description, qty: Number(l.quantity),
            price: Number(l.unitPrice), total: Number(l.lineTotal),
            supplier: l.supplier?.name,
          })),
          po: req.purchaseOrder,
        });
      }

      case "approve": {
        const { requisition_id, comment } = body;
        const req = await prisma.requisition.findFirst({
          where: { id: requisition_id, organizationId: ctx.org.id },
          include: {
            approvalSteps: {
              where: { status: "PENDING" },
              orderBy: { sequence: "asc" },
            },
          },
        });
        if (!req) return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
        const pending = req.approvalSteps[0];
        if (!pending) return NextResponse.json({ error: "No pending approval steps" }, { status: 400 });

        await prisma.approvalStep.update({
          where: { id: pending.id },
          data: {
            status:     "APPROVED",
            comment:    comment || "Approved",
            decidedAt:  new Date(),
            approverId: ctx.profile.id,
          },
        });

        const remaining = await prisma.approvalStep.count({
          where: { requisitionId: req.id, status: "PENDING" },
        });

        const newStatus = remaining === 0 ? "APPROVED" : "MANAGER_APPROVAL";
        await prisma.requisition.update({ where: { id: req.id }, data: { status: newStatus } });

        return NextResponse.json({
          success: true,
          new_status: newStatus,
          remaining_steps: remaining,
          fully_approved: remaining === 0,
        });
      }

      case "create_po": {
        const { requisition_id, payment_terms, delivery_address, notes } = body;
        const req = await prisma.requisition.findFirst({
          where: { id: requisition_id, organizationId: ctx.org.id, status: "APPROVED" },
          include: { lineItems: { include: { supplier: { select: { id: true, name: true, contactEmail: true } } } } },
        });
        if (!req) {
          return NextResponse.json({ error: "Approved requisition not found. Ensure it is fully APPROVED before creating a PO." }, { status: 400 });
        }

        const count     = await prisma.purchaseOrder.count({ where: { organizationId: ctx.org.id } });
        const poNum     = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;
        const supplierId = req.lineItems.find(l => l.supplierId)?.supplierId ?? null;
        const supEmail   = req.lineItems.find(l => l.supplier?.contactEmail)?.supplier?.contactEmail ?? null;

        const po = await prisma.purchaseOrder.create({
          data: {
            organizationId:  ctx.org.id,
            requisitionId:   req.id,
            createdById:     ctx.profile.id,
            supplierId:      supplierId,
            poNumber:        poNum,
            status:          "SENT",
            routingMethod:   "EMAIL",
            supplierEmail:   supEmail,
            paymentTerms:    payment_terms || "Net 30",
            deliveryAddress: delivery_address || null,
            notes:           notes || null,
            currency:        req.currency,
            subtotal:        req.totalAmount,
            taxAmount:       req.taxAmount,
            totalAmount:     Number(req.totalAmount) + Number(req.taxAmount),
            issuedAt:        new Date(),
            lineItems: {
              create: req.lineItems.map(l => ({
                description: l.description,
                quantity:    l.quantity,
                unitPrice:   l.unitPrice,
                lineTotal:   l.lineTotal,
                supplierId:  l.supplierId || null,
              })),
            },
          },
        });

        await prisma.requisition.update({ where: { id: req.id }, data: { status: "PO_CREATED" } });

        return NextResponse.json({
          success: true,
          po_number: poNum,
          id: po.id,
          status: "SENT",
          total: Number(req.totalAmount) + Number(req.taxAmount),
          supplier_email: supEmail,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error("[procurement/orchestrate]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
