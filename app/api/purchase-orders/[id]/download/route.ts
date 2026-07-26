import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });
    const org = await getCurrentOrganization();
    if (!org) return new NextResponse("Not found", { status: 404 });
    const po = await prisma.purchaseOrder.findFirst({
      where: { id, organizationId: org.id },
      include: { lineItems: true, supplier: true, organization: true },
    });
    if (!po) return new NextResponse("PO not found", { status: 404 });
    const fmt = (n: number) => "Rs." + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
    const dt = (d: any) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
    const rows = (po.lineItems || []).map((li: any, i: number) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td>${li.description || "—"}</td>
        <td class="c">${li.quantity ?? 1}</td>
        <td class="r">${fmt(li.unitPrice ?? 0)}</td>
        <td class="c">${li.glAccount || "—"}</td>
        <td class="r">${fmt(li.lineTotal ?? 0)}</td>
      </tr>`).join("");
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Purchase Order — ${po.poNumber}</title>
<style>
  @page { size: A4; margin: 15mm 15mm 20mm 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Arial', sans-serif; font-size: 10.5px; color: #111; background: white; }
  .page { width: 100%; max-width: 780px; margin: 0 auto; }
  /* Header */
  .hdr { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 3px solid #1A2A52; margin-bottom: 20px; }
  .brand-name { font-size: 24px; font-weight: 900; color: #1A2A52; letter-spacing: -0.5px; }
  .brand-tag { font-size: 8px; color: #C8A04D; letter-spacing: 2.5px; text-transform: uppercase; margin-top: 1px; }
  .brand-addr { font-size: 9px; color: #6b7280; margin-top: 8px; line-height: 1.6; }
  .po-right { text-align: right; }
  .po-title { font-size: 26px; font-weight: 900; color: #1A2A52; letter-spacing: 1px; }
  .po-number { font-size: 13px; font-weight: 700; color: #C8A04D; margin-top: 4px; }
  .po-status { display: inline-block; margin-top: 8px; padding: 3px 12px; border-radius: 20px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background: #dbeafe; color: #1e40af; }
  /* Meta grid */
  .meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .meta-box { background: #f8f9fb; border-radius: 6px; padding: 12px; border-left: 3px solid #1A2A52; }
  .meta-box .lbl { font-size: 8px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
  .meta-box .val { font-size: 11px; font-weight: 600; color: #111; line-height: 1.5; }
  .meta-box .sub { font-size: 9px; color: #6b7280; margin-top: 2px; line-height: 1.5; }
  /* Table */
  .tbl-title { font-size: 9px; font-weight: 700; color: #1A2A52; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  thead tr { background: #1A2A52; }
  thead th { padding: 9px 10px; color: white; font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
  tbody tr:nth-child(even) { background: #f9fafb; }
  tbody tr:hover { background: #f0f4ff; }
  tbody td { padding: 8px 10px; font-size: 10px; color: #374151; border-bottom: 1px solid #e5e7eb; vertical-align: top; line-height: 1.4; }
  .c { text-align: center; }
  .r { text-align: right; font-family: monospace; }
  /* Totals */
  .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 20px; }
  .totals { width: 260px; }
  .trow { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb; font-size: 10px; color: #374151; }
  .trow.grand { font-weight: 700; font-size: 12px; color: #1A2A52; border-bottom: 2px solid #1A2A52; padding: 8px 0 6px; }
  /* Terms */
  .terms { background: #f0f4ff; border-radius: 6px; padding: 12px 14px; margin-bottom: 20px; border: 1px solid #dbeafe; }
  .terms .lbl { font-size: 8px; font-weight: 700; color: #1A2A52; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
  .terms p { font-size: 9px; color: #374151; line-height: 1.7; }
  /* Footer / Signatures */
  .sigs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 10px; border-top: 2px solid #e5e7eb; padding-top: 20px; }
  .sig-box { text-align: center; }
  .sig-line { height: 40px; border-bottom: 1.5px solid #374151; margin-bottom: 6px; }
  .sig-name { font-size: 10px; font-weight: 600; color: #111; }
  .sig-role { font-size: 9px; color: #6b7280; margin-top: 1px; }
  .footer-note { text-align: center; font-size: 8.5px; color: #9ca3af; margin-top: 16px; padding-top: 10px; border-top: 1px solid #f3f4f6; }
  /* Gold accent bar */
  .accent-bar { height: 4px; background: linear-gradient(90deg, #1A2A52, #C8A04D); border-radius: 2px; margin-bottom: 20px; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { max-width: 100%; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="hdr">
    <div>
      <div class="brand-name">Veltriance</div>
      <div class="brand-tag">Technologies LLP</div>
      <div class="brand-addr">
        Procurement Platform<br/>
        ${(po as any).organization?.name || "Ace Technologies India Pvt. Ltd."}<br/>
        CIN: U72900KA2024PTC000001
      </div>
    </div>
    <div class="po-right">
      <div class="po-title">PURCHASE ORDER</div>
      <div class="po-number">${po.poNumber}</div>
      <div><span class="po-status">${po.status || "DRAFT"}</span></div>
    </div>
  </div>

  <div class="accent-bar"></div>

  <div class="meta">
    <div class="meta-box">
      <div class="lbl">Bill To / Ship From</div>
      <div class="val">${(po as any).organization?.name || "Ace Technologies India"}</div>
      <div class="sub">GSTIN: 29AABCA1234A1Z5<br/>PAN: AABCA1234A</div>
    </div>
    <div class="meta-box">
      <div class="lbl">Supplier</div>
      <div class="val">${(po as any).supplier?.name || "—"}</div>
      <div class="sub">
        ${(po as any).supplier?.code || ""}<br/>
        ${(po as any).supplier?.contactEmail || ""}<br/>
        ${(po as any).supplier?.contactPhone || ""}
      </div>
    </div>
    <div class="meta-box">
      <div class="lbl">PO Details</div>
      <div class="val">Issued: ${dt((po as any).issuedAt || po.createdAt)}</div>
      <div class="sub">
        Required by: ${dt((po as any).requiredDate)}<br/>
        Payment: ${(po as any).paymentTerms || (po as any).supplier?.paymentTerms || "Net 30"}<br/>
        Currency: ${po.currency || "INR"}
      </div>
    </div>
  </div>

  <div class="meta-box" style="margin-bottom:16px; border-left-color:#C8A04D;">
    <div class="lbl">Delivery Location</div>
    <div class="val">${(po as any).deliveryLocation || "To be confirmed"}</div>
  </div>

  <div class="tbl-title">Line Items</div>
  <table>
    <thead>
      <tr>
        <th class="c" style="width:4%">#</th>
        <th style="width:42%">Description</th>
        <th class="c" style="width:7%">Qty</th>
        <th class="r" style="width:15%">Unit Price</th>
        <th class="c" style="width:10%">GL A/c</th>
        <th class="r" style="width:15%">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6" class="c" style="color:#9ca3af;padding:20px">No line items</td></tr>'}
    </tbody>
  </table>

  <div class="totals-wrap">
    <div class="totals">
      <div class="trow"><span>Subtotal (excl. GST)</span><span>${fmt(po.subtotal ?? 0)}</span></div>
      <div class="trow"><span>IGST @ 18%</span><span>${fmt(po.totalTax ?? 0)}</span></div>
      <div class="trow grand"><span>TOTAL AMOUNT</span><span>${fmt(po.totalAmount ?? 0)}</span></div>
    </div>
  </div>

  <div class="terms">
    <div class="lbl">Terms &amp; Conditions</div>
    <p>
      1. This Purchase Order is issued subject to the standard procurement terms of ${(po as any).organization?.name || "Ace Technologies India"}.<br/>
      2. All goods/services must strictly conform to specifications. Any deviation requires prior written approval from the Procurement team.<br/>
      3. Supplier invoice must quote PO number <strong>${po.poNumber}</strong>. Invoices without reference will not be processed.<br/>
      4. Payment will be made as per agreed terms upon receipt of goods/services and valid tax invoice.<br/>
      5. Supplier warrants that goods/services are free from defects and comply with all applicable laws and regulations.
    </p>
  </div>

  <div class="sigs">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-name">Procurement Manager</div>
      <div class="sig-role">Authorised Signatory</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-name">Finance Controller</div>
      <div class="sig-role">Finance Approval</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-name">${(po as any).supplier?.contactName || "Supplier Representative"}</div>
      <div class="sig-role">Supplier Acknowledgement</div>
    </div>
  </div>

  <div class="footer-note">
    Generated by Veltriance Procurement Platform &nbsp;|&nbsp; ${po.poNumber} &nbsp;|&nbsp; ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
    <br/>This is a system-generated document and is valid without a physical signature when transmitted electronically.
  </div>
</div>
<script>window.onload=function(){window.print();}</script>
</body>
</html>`;
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="PO-${po.poNumber}.html"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("[po-download]", e?.message);
    return new NextResponse("Error: " + e?.message, { status: 500 });
  }
}
