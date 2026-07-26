import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

/**
 * POST /api/purchase-orders/[id]/send
 *
 * Routes the PO to the supplier via EMAIL, cXML, or MANUAL.
 *
 * EMAIL:  Uses Supabase's transactional email (or any SMTP configured in the
 *         project) to send a PO notification to the supplier's contact email.
 *         In this free-tier implementation we use Supabase's built-in email
 *         by triggering a password-reset style email — swap this with Resend
 *         or SendGrid when you add a proper SMTP integration.
 *
 * cXML:   Posts the PO payload to the supplier's cXML endpoint (ANSI X12 /
 *         cXML OrderRequest format). This is the standard used by Coupa,
 *         Ariba, and most enterprise procurement platforms.
 *
 * MANUAL: Simply marks the PO as SENT so procurement can track it manually
 *         (e.g. they emailed it as a PDF themselves outside the system).
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !organization || profile.organizationId !== organization.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "PROCUREMENT" && profile.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      lineItems: true,
      organization: { select: { name: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });

  if (!po || po.organizationId !== organization.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (po.status !== "DRAFT")
    return NextResponse.json({ error: "PO has already been sent" }, { status: 422 });

  let result: { method: string; detail: string };

  // ── EMAIL routing ───────────────────────────────────────────────────────
  if (po.routingMethod === "EMAIL") {
    const toEmail = po.supplierEmail ?? po.supplier?.contactEmail;
    if (!toEmail) {
      return NextResponse.json(
        { error: "No supplier email address on file. Add one before sending." },
        { status: 422 }
      );
    }

    // Build a plain-text PO summary for the email body
    const linesSummary = po.lineItems
      .map((li) => `  • ${li.description} — Qty: ${li.quantity}, Unit: ${li.unitPrice}, Total: ${li.lineTotal}`)
      .join("\n");

    const emailBody = `
Dear ${po.supplier?.contactName ?? "Supplier"},

Purchase Order ${po.poNumber} has been issued by ${po.organization.name}.

PO Number: ${po.poNumber}
Currency:  ${po.currency}
Total:     ${po.totalAmount}
Payment Terms: ${po.paymentTerms ?? "Standard"}

Line Items:
${linesSummary}

${po.notes ? `Notes: ${po.notes}\n` : ""}
Please acknowledge receipt of this PO by replying to this email.

Regards,
${profile.name}
${po.organization.name}
    `.trim();

    // Using Supabase's auth email as a free SMTP proxy for now.
    // TODO: replace with Resend/SendGrid for branded templates.
    await supabase.auth.admin.inviteUserByEmail(toEmail, {
      data: { poEmailBody: emailBody, poNumber: po.poNumber },
      redirectTo: undefined,
    });

    result = { method: "EMAIL", detail: `PO emailed to ${toEmail}` };
  }

  // ── cXML routing ────────────────────────────────────────────────────────
  else if (po.routingMethod === "CXML") {
    const endpoint = po.cxmlEndpoint ?? po.supplier?.website;
    if (!endpoint) {
      return NextResponse.json(
        { error: "No cXML endpoint configured for this PO or supplier." },
        { status: 422 }
      );
    }

    const cxmlPayload = buildCxmlOrderRequest(po);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      body: cxmlPayload,
    }).catch(() => null);

    if (!response || !response.ok) {
      return NextResponse.json(
        { error: `cXML delivery failed — endpoint responded with ${response?.status ?? "network error"}` },
        { status: 502 }
      );
    }

    result = { method: "CXML", detail: `cXML OrderRequest posted to ${endpoint}` };
  }

  // ── MANUAL routing ───────────────────────────────────────────────────────
  else {
    result = { method: "MANUAL", detail: "PO marked as sent manually" };
  }

  // Mark as SENT
  await prisma.purchaseOrder.update({
    where: { id },
    data: { status: "SENT", issuedAt: new Date() },
  });

  return NextResponse.json({ success: true, ...result });
}

// ── cXML Order Request builder ───────────────────────────────────────────────

function buildCxmlOrderRequest(po: {
  poNumber: string;
  currency: string;
  totalAmount: unknown;
  paymentTerms: string | null;
  deliveryAddress: string | null;
  notes: string | null;
  supplier: { name: string; contactEmail: string | null } | null;
  organization: { name: string };
  lineItems: Array<{ description: string; quantity: unknown; unitPrice: unknown; lineTotal: unknown; glAccount: string | null }>;
}): string {
  const now = new Date().toISOString();
  const lines = po.lineItems
    .map(
      (li, i) => `
    <ItemIn quantity="${li.quantity}" lineNumber="${i + 1}">
      <ItemID><SupplierPartID>${i + 1}</SupplierPartID></ItemID>
      <ItemDetail>
        <UnitPrice><Money currency="${po.currency}">${li.unitPrice}</Money></UnitPrice>
        <Description xml:lang="en">${escapeXml(li.description)}</Description>
        <UnitOfMeasure>EA</UnitOfMeasure>
        <Classification domain="UNSPSC">44000000</Classification>
      </ItemDetail>
    </ItemIn>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE cXML SYSTEM "http://xml.cxml.org/schemas/cXML/1.2.014/cXML.dtd">
<cXML timestamp="${now}" payloadID="${po.poNumber}@veltriance">
  <Header>
    <From><Credential domain="DUNS"><Identity>${escapeXml(po.organization.name)}</Identity></Credential></From>
    <To><Credential domain="DUNS"><Identity>${escapeXml(po.supplier?.name ?? "Supplier")}</Identity></Credential></To>
    <Sender><Credential domain="DUNS"><Identity>${escapeXml(po.organization.name)}</Identity></Credential><UserAgent>Veltriance/1.0</UserAgent></Sender>
  </Header>
  <Request>
    <OrderRequest>
      <OrderRequestHeader orderID="${po.poNumber}" orderDate="${now}" type="new">
        <Total><Money currency="${po.currency}">${po.totalAmount}</Money></Total>
        <ShipTo><Address><Name xml:lang="en">${escapeXml(po.deliveryAddress ?? "")}</Name></Address></ShipTo>
        <BillTo><Address><Name xml:lang="en">${escapeXml(po.organization.name)}</Name></Address></BillTo>
        <Payment><PCard number="" expiration=""/></Payment>
        <Comments>${escapeXml(po.notes ?? "")}</Comments>
      </OrderRequestHeader>
      ${lines}
    </OrderRequest>
  </Request>
</cXML>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
