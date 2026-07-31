import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateRequisitionNumber } from "@/lib/requisition-number";
import { hasDangerousXmlDeclarations, parsePunchOutOrderMessage } from "@/lib/cxml";

/**
 * POST /api/punchout/[catalogId]/return
 *
 * Hit directly by the USER'S BROWSER, form-posted here by the supplier's
 * site once they finish shopping (per the cXML PunchOut spec — this is not
 * a server-to-server call, so no Supabase session cookie can be relied on).
 * Authentication is entirely via the BuyerCookie matching a PENDING
 * PunchoutSession created by the /setup endpoint. A malformed or hostile
 * payload must never 500 — it should fail safely and redirect the user
 * somewhere sane.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ catalogId: string }> }) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const fallback = (reason: string) => NextResponse.redirect(`${baseUrl}/dashboard/catalogs?punchoutError=${encodeURIComponent(reason)}`, 303);

  try {
    const { catalogId } = await ctx.params;
    const contentType = req.headers.get("content-type") || "";
    const rawBody = await req.text();

    let cxml: string;
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(rawBody);
      const encoded = params.get("cxml-urlencoded");
      if (!encoded) return fallback("Missing cxml-urlencoded field");
      cxml = decodeURIComponent(encoded);
    } else {
      cxml = rawBody;
    }

    if (hasDangerousXmlDeclarations(cxml)) return fallback("Disallowed DOCTYPE/ENTITY declaration");

    let order;
    try { order = parsePunchOutOrderMessage(cxml); }
    catch (e: any) { return fallback(`Could not parse the returned cart: ${e?.message}`); }

    const session = await prisma.punchoutSession.findUnique({
      where: { buyerCookie: order.buyerCookie },
      include: { catalog: true },
    });
    if (!session || session.catalogId !== catalogId) return fallback("Unknown or mismatched punchout session");
    if (session.status !== "PENDING") return fallback("This punchout session was already used");
    if (session.expiresAt < new Date()) {
      await prisma.punchoutSession.update({ where: { id: session.id }, data: { status: "EXPIRED" } });
      return fallback("Punchout session expired");
    }

    if (order.items.length === 0) {
      await prisma.punchoutSession.update({ where: { id: session.id }, data: { status: "ERROR", errorMessage: "Empty cart returned", returnedCartXml: cxml } });
      return fallback("Supplier returned an empty cart");
    }

    const lineItems = order.items.map(it => {
      const lineTotal = it.quantity * it.unitPrice;
      return { ...it, lineTotal };
    });
    const totalAmount = lineItems.reduce((s, li) => s + li.lineTotal, 0);
    const currency = lineItems[0]?.currency || "INR";

    const requisitionNumber = await generateRequisitionNumber(session.organizationId);
    const requisition = await prisma.requisition.create({
      data: {
        organizationId: session.organizationId,
        requisitionNumber,
        title: `Punchout order — ${session.catalog.name}`,
        status: "DRAFT",
        intakeSource: "PUNCHOUT",
        requestorId: session.requestorId,
        currency,
        totalAmount,
        taxAmount: 0,
        businessJustification: `Created from a punchout session with ${session.catalog.name}. Review the cart below before submitting for approval.`,
        lineItems: {
          create: lineItems.map(li => ({
            description: li.description,
            partNumber: li.supplierPartId,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            lineTotal: li.lineTotal,
            taxRate: 0,
            taxAmount: 0,
          })),
        },
      },
    });

    await prisma.punchoutSession.update({
      where: { id: session.id },
      data: { status: "RETURNED", returnedCartXml: cxml, requisitionId: requisition.id },
    });

    return NextResponse.redirect(`${baseUrl}/dashboard/requisitions/${requisition.id}`, 303);
  } catch (e: any) {
    console.error("[punchout return]", e?.message);
    return fallback("Unexpected error processing the returned cart");
  }
}
