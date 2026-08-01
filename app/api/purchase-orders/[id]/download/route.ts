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
      include: { lineItems: true, supplier: true, organization: { select: { name: true } }, chartOfAccount: { select: { name: true, code: true } } },
    });
    if (!po) return new NextResponse("PO not found", { status: 404 });

    const S   = (po as any).supplier;
    const O   = (po as any).organization;
    const LI  = (po as any).lineItems ?? [];
    const num = (po as any).poNumber ?? "PO-????";
    const deliveryLoc = (po as any).deliveryLocation ?? (po as any).deliveryAddress ?? "To be confirmed";
    const requiredDt  = (po as any).requiredDate ?? (po as any).expectedDelivery ?? null;
    const coa = (po as any).chartOfAccount as { name: string; code: string } | null;
    const glCoding = (po as any).glCoding as Record<string, string> | null;
    const glCodingStr = glCoding && Object.keys(glCoding).length > 0 ? Object.values(glCoding).join(" - ") : null;

    const fmt = (n: any) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
    const dt  = (d: any) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

    const rows = LI.map((li: any, i: number) => `
      <tr style="background:${i%2===1?"#f9fafb":"white"}">
        <td style="text-align:center;padding:8px 10px;font-size:10px;border-bottom:1px solid #e5e7eb">${i+1}</td>
        <td style="padding:8px 10px;font-size:10px;border-bottom:1px solid #e5e7eb">${li.description||"—"}</td>
        <td style="text-align:center;padding:8px 10px;font-size:10px;border-bottom:1px solid #e5e7eb">${li.quantity??1}</td>
        <td style="text-align:right;padding:8px 10px;font-size:10px;font-family:monospace;border-bottom:1px solid #e5e7eb">${fmt(li.unitPrice??0)}</td>
        <td style="text-align:center;padding:8px 10px;font-size:10px;border-bottom:1px solid #e5e7eb">${li.glAccount||"—"}</td>
        <td style="text-align:right;padding:8px 10px;font-size:10px;font-family:monospace;border-bottom:1px solid #e5e7eb">${fmt(li.lineTotal??0)}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Purchase Order — ${num}</title>
<style>
@page{size:A4;margin:15mm}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111827;background:white}
.page{max-width:780px;margin:0 auto;padding:24px 0}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="page">
<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:3px solid #1A2A52;margin-bottom:20px">
  <div>
    <div style="font-size:24px;font-weight:900;color:#1A2A52">Veltriance</div>
    <div style="font-size:8px;color:#C8A04D;letter-spacing:2.5px;text-transform:uppercase;margin-top:2px">Technologies LLP</div>
    <div style="font-size:9px;color:#6b7280;margin-top:10px;line-height:1.7">Procurement Platform<br>${O?.name||"—"}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:28px;font-weight:900;color:#1A2A52">PURCHASE ORDER</div>
    <div style="font-size:14px;font-weight:700;color:#C8A04D;margin-top:4px">${num}</div>
    <div style="display:inline-block;margin-top:8px;padding:4px 14px;border-radius:20px;font-size:9px;font-weight:700;text-transform:uppercase;background:#dbeafe;color:#1e40af">${(po as any).status||"DRAFT"}</div>
  </div>
</div>
<div style="height:4px;background:linear-gradient(90deg,#1A2A52,#C8A04D);border-radius:2px;margin-bottom:20px"></div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
  <div style="background:#f8f9fb;border-radius:6px;padding:12px;border-left:3px solid #1A2A52">
    <div style="font-size:8px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Bill To</div>
    <div style="font-size:11px;font-weight:600;color:#111;line-height:1.5">${O?.name||"—"}</div>
  </div>
  <div style="background:#f8f9fb;border-radius:6px;padding:12px;border-left:3px solid #1A2A52">
    <div style="font-size:8px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Supplier</div>
    <div style="font-size:11px;font-weight:600;color:#111;line-height:1.5">${S?.name||"—"}</div>
    <div style="font-size:9px;color:#6b7280;margin-top:2px;line-height:1.6">${S?.code||""}<br>${S?.contactEmail||""}<br>${S?.contactPhone||""}</div>
  </div>
  <div style="background:#f8f9fb;border-radius:6px;padding:12px;border-left:3px solid #1A2A52">
    <div style="font-size:8px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">PO Details</div>
    <div style="font-size:11px;font-weight:600;color:#111">Issued: ${dt((po as any).issuedAt||(po as any).createdAt)}</div>
    <div style="font-size:9px;color:#6b7280;margin-top:2px;line-height:1.6">Required by: ${dt(requiredDt)}<br>Payment: ${(po as any).paymentTerms||S?.paymentTerms||"Net 30"}<br>Currency: ${(po as any).currency||"INR"}</div>
  </div>
</div>
<div style="background:#f8f9fb;border-radius:6px;padding:12px;border-left:3px solid #C8A04D;margin-bottom:20px">
  <div style="font-size:8px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Delivery Location</div>
  <div style="font-size:11px;font-weight:600;color:#111">${deliveryLoc}</div>
  ${coa || glCodingStr ? `<div style="font-size:8px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-top:10px;margin-bottom:5px">Chart of Accounts</div>
  <div style="font-size:11px;font-weight:600;color:#111">${coa ? `${coa.name} (${coa.code})` : "—"}${glCodingStr ? ` &middot; GL: ${glCodingStr}` : ""}</div>` : ""}
</div>
<div style="font-size:9px;font-weight:700;color:#1A2A52;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Line Items</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:20px">
  <thead><tr style="background:#1A2A52">
    <th style="padding:9px 10px;color:white;font-size:8.5px;font-weight:700;text-transform:uppercase;text-align:center;width:4%">#</th>
    <th style="padding:9px 10px;color:white;font-size:8.5px;font-weight:700;text-transform:uppercase;text-align:left;width:44%">Description</th>
    <th style="padding:9px 10px;color:white;font-size:8.5px;font-weight:700;text-transform:uppercase;text-align:center;width:7%">Qty</th>
    <th style="padding:9px 10px;color:white;font-size:8.5px;font-weight:700;text-transform:uppercase;text-align:right;width:15%">Unit Price</th>
    <th style="padding:9px 10px;color:white;font-size:8.5px;font-weight:700;text-transform:uppercase;text-align:center;width:10%">GL A/c</th>
    <th style="padding:9px 10px;color:white;font-size:8.5px;font-weight:700;text-transform:uppercase;text-align:right;width:15%">Total</th>
  </tr></thead>
  <tbody>${rows||'<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:20px;font-size:10px">No line items</td></tr>'}</tbody>
</table>
<div style="display:flex;justify-content:flex-end;margin-bottom:20px">
  <div style="width:260px">
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e5e7eb;font-size:10px;color:#374151"><span>Subtotal (excl. tax)</span><span style="font-family:monospace">${fmt((po as any).subtotal??0)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e5e7eb;font-size:10px;color:#374151"><span>Tax</span><span style="font-family:monospace">${fmt((po as any).totalTax??(po as any).taxAmount??0)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:8px 0 6px;font-weight:700;font-size:13px;color:#1A2A52;border-top:2px solid #1A2A52;margin-top:4px"><span>TOTAL AMOUNT</span><span style="font-family:monospace">${fmt((po as any).totalAmount??0)}</span></div>
  </div>
</div>
<div style="background:#f0f4ff;border-radius:6px;padding:14px;margin-bottom:24px;border:1px solid #dbeafe">
  <div style="font-size:8px;font-weight:700;color:#1A2A52;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Terms &amp; Conditions</div>
  <p style="font-size:9px;color:#374151;line-height:1.8">
    1. This Purchase Order is issued subject to the standard procurement terms of ${O?.name||"the issuing organization"}.<br>
    2. All goods/services must conform to specifications. Any deviation requires prior written approval.<br>
    3. Invoice must quote PO number <strong>${num}</strong>. Invoices without reference will not be processed.<br>
    4. Payment will be made as per agreed terms upon receipt of goods/services and valid tax invoice.
  </p>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;border-top:2px solid #e5e7eb;padding-top:24px">
  <div style="text-align:center"><div style="height:44px;border-bottom:1.5px solid #374151;margin-bottom:8px"></div><div style="font-size:10px;font-weight:600">Procurement Manager</div><div style="font-size:9px;color:#6b7280;margin-top:2px">Authorised Signatory</div></div>
  <div style="text-align:center"><div style="height:44px;border-bottom:1.5px solid #374151;margin-bottom:8px"></div><div style="font-size:10px;font-weight:600">Finance Controller</div><div style="font-size:9px;color:#6b7280;margin-top:2px">Finance Approval</div></div>
  <div style="text-align:center"><div style="height:44px;border-bottom:1.5px solid #374151;margin-bottom:8px"></div><div style="font-size:10px;font-weight:600">${S?.contactName||"Supplier Representative"}</div><div style="font-size:9px;color:#6b7280;margin-top:2px">Supplier Acknowledgement</div></div>
</div>
<div style="text-align:center;font-size:8.5px;color:#9ca3af;margin-top:20px;padding-top:12px;border-top:1px solid #f3f4f6">
  Generated by Veltriance Procurement Platform &nbsp;|&nbsp; ${num} &nbsp;|&nbsp; ${new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"})}<br>
  System-generated document — valid without physical signature when transmitted electronically.
</div>
</div>
<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},500);});</script>
</body></html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="PO-${num}.html"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return new NextResponse(`<html><body style="font-family:Arial;padding:40px;color:red">Error: ${e?.message}</body></html>`, { status: 500, headers: { "Content-Type": "text/html" } });
  }
}
