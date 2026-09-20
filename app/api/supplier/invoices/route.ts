import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSupplier } from "@/lib/supplier-session";
import { createInvoice } from "@/lib/invoicing";
import { sendEmail } from "@/lib/email";

const line = z.object({ poLineId: z.string().min(1), quantity: z.number().positive().max(1e9), unitPrice: z.number().min(0).max(1e9) });
const schema = z.object({
  purchaseOrderId: z.string().min(1), invoiceNumber: z.string().trim().min(1).max(60), invoiceDate: z.string().date(), dueDate: z.string().date().nullable().optional(),
  taxAmount: z.number().min(0).max(1e12).default(0), notes: z.string().trim().max(1000).nullable().optional(), lines: z.array(line).min(1).max(200),
});

/**
 * A vendor bills against their own purchase order. Descriptions and currency come from the order, never from the
 * vendor, so all they can state is what they're charging; the three-way match then checks it against what was received.
 */
export async function POST(req: NextRequest) {
  const a = await requireSupplier();
  if ("error" in a) return a.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 });
  const d = parsed.data;
  const { supplier, organization } = a.s;
  const po = await prisma.purchaseOrder.findFirst({ where: { id: d.purchaseOrderId, supplierId: supplier.id, organizationId: supplier.organizationId, status: { in: ["SENT", "ACKNOWLEDGED", "PARTIALLY_RECEIVED", "RECEIVED", "CLOSED"] } }, include: { lineItems: true, createdBy: { select: { id: true, name: true, email: true } } } });
  if (!po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
  const byId = new Map(po.lineItems.map(l => [l.id, l]));
  if (d.lines.some(l => !byId.has(l.poLineId))) return NextResponse.json({ error: "One of the lines isn't on this purchase order" }, { status: 422 });
  if (new Set(d.lines.map(l => l.poLineId)).size !== d.lines.length) return NextResponse.json({ error: "Each purchase-order line can appear only once" }, { status: 422 });

  const lines = d.lines.map(l => ({ poLineId: l.poLineId, description: byId.get(l.poLineId)!.description, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: Math.round(l.quantity * l.unitPrice * 100) / 100 }));
  const subtotal = Math.round(lines.reduce((s, l) => s + Math.round(l.lineTotal * 100), 0)) / 100;
  const r = await createInvoice({
    organizationId: supplier.organizationId, supplierId: supplier.id, purchaseOrderId: po.id, source: "SUPPLIER",
    actor: { id: po.createdBy.id, name: `${supplier.name} (supplier portal)` },
    invoiceNumber: d.invoiceNumber, invoiceDate: new Date(d.invoiceDate), dueDate: d.dueDate ? new Date(d.dueDate) : null, currency: po.currency,
    subtotal, taxAmount: d.taxAmount, totalAmount: Math.round((subtotal + d.taxAmount) * 100) / 100, notes: d.notes ?? null, lines,
  });
  if (r.status !== 201) return NextResponse.json(r.json, { status: r.status });

  const j = r.json as { invoice: { internalNumber: string; status: string }; match: { issues: { blocking: boolean; message: string }[] } };
  await sendEmail({ to: po.createdBy.email, subject: `Invoice ${d.invoiceNumber} from ${supplier.name}`, text: `${supplier.name} submitted invoice ${d.invoiceNumber} against ${po.poNumber} in the supplier portal. It is ${j.invoice.status.toLowerCase()}.\n\n${organization.name}` }).catch(() => {});
  // Suppliers see whether it's moving and, if not, plain reasons; never internal notes.
  return NextResponse.json({ status: j.invoice.status, reference: j.invoice.internalNumber, issues: j.match.issues.filter(i => i.blocking).map(i => i.message) }, { status: 201 });
}
