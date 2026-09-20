import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { invoiceAccess } from "@/lib/invoice-access";
import { createInvoice } from "@/lib/invoicing";

export async function GET(req: NextRequest) {
  const a = await invoiceAccess();
  if ("error" in a) return a.error;
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const status = req.nextUrl.searchParams.get("status");
  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: a.org.id, ...(status && { status: status as never }),
      ...(q && { OR: [{ invoiceNumber: { contains: q, mode: "insensitive" } }, { internalNumber: { contains: q, mode: "insensitive" } }, { supplier: { name: { contains: q, mode: "insensitive" } } }, { purchaseOrder: { poNumber: { contains: q, mode: "insensitive" } } }] }),
    },
    orderBy: { createdAt: "desc" }, take: 200,
    select: { id: true, internalNumber: true, invoiceNumber: true, status: true, invoiceDate: true, dueDate: true, currency: true, totalAmount: true, overridden: true, matchResult: true, supplier: { select: { name: true } }, purchaseOrder: { select: { id: true, poNumber: true } } },
  });
  return NextResponse.json({ invoices: invoices.map(i => ({ ...i, issues: ((i.matchResult as { issues?: { blocking: boolean }[] } | null)?.issues ?? []).filter(x => x.blocking).length, matchResult: undefined })) });
}

const line = z.object({ poLineId: z.string().min(1).nullable().optional(), description: z.string().trim().min(1).max(300), quantity: z.number().positive().max(1e9), unitPrice: z.number().min(0).max(1e9), lineTotal: z.number().min(0).max(1e12) });
const schema = z.object({
  supplierId: z.string().min(1).optional(), purchaseOrderId: z.string().min(1).nullable().optional(),
  invoiceNumber: z.string().trim().min(1).max(60), invoiceDate: z.string().date(), dueDate: z.string().date().nullable().optional(),
  currency: z.string().trim().length(3).optional(), subtotal: z.number().min(0).max(1e12), taxAmount: z.number().min(0).max(1e12).default(0), totalAmount: z.number().min(0).max(1e12),
  notes: z.string().trim().max(1000).nullable().optional(), lines: z.array(line).min(1).max(200),
});

export async function POST(req: NextRequest) {
  const a = await invoiceAccess();
  if ("error" in a) return a.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 });
  const d = parsed.data;
  const r = await createInvoice({ organizationId: a.org.id, actor: { id: a.profile.id, name: a.profile.name }, ...d, invoiceDate: new Date(d.invoiceDate), dueDate: d.dueDate ? new Date(d.dueDate) : null });
  return NextResponse.json(r.json, { status: r.status });
}
