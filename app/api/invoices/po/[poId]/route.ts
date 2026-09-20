import { NextRequest, NextResponse } from "next/server";
import { invoiceAccess } from "@/lib/invoice-access";
import { invoiceableSummary } from "@/lib/invoicing";

/** Per line: ordered, received, already invoiced — and so what can be invoiced now. Used to prefill a new invoice. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ poId: string }> }) {
  const a = await invoiceAccess();
  if ("error" in a) return a.error;
  const s = await invoiceableSummary((await ctx.params).poId);
  if (!s || s.po.organizationId !== a.org.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ poNumber: s.po.poNumber, supplierId: s.po.supplierId, currency: s.po.currency, lines: s.lines });
}
