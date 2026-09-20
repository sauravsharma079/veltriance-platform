import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { invoiceAccess } from "@/lib/invoice-access";
import { decideInvoice } from "@/lib/invoicing";

const schema = z.object({ action: z.enum(["approve", "override", "reject", "mark_paid", "rematch"]), reason: z.string().trim().max(1000).optional(), reference: z.string().trim().max(100).optional() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await invoiceAccess();
  if ("error" in a) return a.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unknown action" }, { status: 422 });
  const r = await decideInvoice({ organizationId: a.org.id, actor: a.profile, invoiceId: (await ctx.params).id, ...parsed.data });
  return NextResponse.json(r.json, { status: r.status });
}
