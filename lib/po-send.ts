import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type SendResult =
  | { method: string; detail: string; changeOrderNumber: number }
  | { error: string; status: number };

/**
 * Transmits a PO to its supplier — EMAIL, cXML, or MANUAL — and marks it SENT.
 * Shared by the manual "Send" button (app/api/purchase-orders/[id]/send),
 * automatic transmission right after a requisition is approved (no more
 * DRAFT-and-wait-for-review), and the change-order "Revise" flow (which sets
 * isChangeOrder so the email/cXML clearly reads as a revision, not a new PO).
 */
export async function sendPurchaseOrder(opts: {
  poId: string;
  organizationId: string;
  supabase: SupabaseClient;
  method?: "EMAIL" | "CXML" | "MANUAL";
  supplierEmailOverride?: string;
  actorName?: string;
  actorId?: string;
  isChangeOrder?: boolean;
}): Promise<SendResult> {
  const { poId, organizationId, supabase, isChangeOrder } = opts;

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: {
      supplier: true,
      lineItems: true,
      organization: { select: { name: true } },
    },
  });
  if (!po || po.organizationId !== organizationId) return { error: "Not found", status: 404 };
  if (!isChangeOrder && po.status !== "DRAFT") return { error: "PO has already been sent", status: 422 };

  const method = opts.method ?? po.routingMethod;
  const actorName = opts.actorName ?? "Procurement";
  const orderLabel = isChangeOrder ? `Change Order #${po.changeOrderNumber + 1} to PO ${po.poNumber}` : `Purchase Order ${po.poNumber}`;

  let result: { method: string; detail: string };

  // ── EMAIL routing ───────────────────────────────────────────────────────
  if (method === "EMAIL") {
    const toEmail = opts.supplierEmailOverride ?? po.supplierEmail ?? po.supplier?.contactEmail;
    if (!toEmail) return { error: "No supplier email address on file. Add one before sending.", status: 422 };

    const linesSummary = po.lineItems
      .map((li) => `  • ${li.description} — Qty: ${li.quantity}, Unit: ${li.unitPrice}, Total: ${li.lineTotal}`)
      .join("\n");

    const emailBody = `
Dear ${po.supplier?.contactName ?? "Supplier"},

${orderLabel} has been issued by ${po.organization.name}.

PO Number: ${po.poNumber}${isChangeOrder ? `\nChange Order: #${po.changeOrderNumber + 1}` : ""}
Currency:  ${po.currency}
Total:     ${po.totalAmount}
Payment Terms: ${po.paymentTerms ?? "Standard"}

Line Items:
${linesSummary}

${po.notes ? `Notes: ${po.notes}\n` : ""}
Please acknowledge receipt of this ${isChangeOrder ? "change order" : "PO"} by replying to this email.

Regards,
${actorName}
${po.organization.name}
    `.trim();

    // Using Supabase's auth email as a free SMTP proxy for now.
    // TODO: replace with Resend/SendGrid for branded templates.
    await supabase.auth.admin.inviteUserByEmail(toEmail, {
      data: { poEmailBody: emailBody, poNumber: po.poNumber },
      redirectTo: undefined,
    });

    result = { method: "EMAIL", detail: `${isChangeOrder ? "Change order" : "PO"} emailed to ${toEmail}` };
  }

  // ── cXML routing ────────────────────────────────────────────────────────
  else if (method === "CXML") {
    const endpoint = po.cxmlEndpoint ?? po.supplier?.cxmlEndpoint ?? po.supplier?.website;
    if (!endpoint) return { error: "No cXML endpoint configured for this PO or supplier.", status: 422 };

    const cxmlPayload = buildCxmlOrderRequest(po, isChangeOrder ?? false);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      body: cxmlPayload,
    }).catch(() => null);

    if (!response || !response.ok) {
      return { error: `cXML delivery failed — endpoint responded with ${response?.status ?? "network error"}`, status: 502 };
    }

    result = { method: "CXML", detail: `cXML Order${isChangeOrder ? "Update" : "Request"} posted to ${endpoint}` };
  }

  // ── MANUAL routing ───────────────────────────────────────────────────────
  else {
    result = { method: "MANUAL", detail: `PO marked as sent manually${isChangeOrder ? " (change order)" : ""}` };
  }

  const changeOrderNumber = isChangeOrder ? po.changeOrderNumber + 1 : po.changeOrderNumber;
  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { status: "SENT", issuedAt: new Date(), routingMethod: method, changeOrderNumber },
  });

  await logAudit({
    organizationId, userId: opts.actorId, userName: actorName,
    action: "SENT", entity: "PURCHASE_ORDER", entityId: poId, entityLabel: po.poNumber,
    details: { method: result.method, isChangeOrder: !!isChangeOrder, changeOrderNumber },
  });

  return { ...result, changeOrderNumber };
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
}, isChangeOrder: boolean): string {
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
      <OrderRequestHeader orderID="${po.poNumber}" orderDate="${now}" type="${isChangeOrder ? "update" : "new"}">
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
