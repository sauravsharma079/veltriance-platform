import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUploadActor } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveUploadActor(req, "requisitions:write");
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { organizationId } = auth.actor;

    const { rows } = await req.json() as { rows: Record<string,string>[] };
    if (!Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });

    const results: { created:number; skipped:number; errors:string[] } = { created:0, skipped:0, errors:[] };
    const count = await prisma.requisition.count({ where: { organizationId } });
    let idx = count;

    for (const row of rows) {
      try {
        const title = (row.title || row.Title || row.description || row.Description || "").trim();
        if (!title) { results.errors.push("Row skipped: missing title"); continue; }

        const amount = parseFloat((row.amount || row.totalAmount || row.total_amount || row.estimatedCost || "0").replace(/[^0-9.]/g, "")) || 0;
        const category = (row.category || row.Category || "General").trim();
        const priority = ((row.priority || row.Priority || "MEDIUM").trim().toUpperCase() as any);
        const department = (row.department || row.Department || "").trim() || null;
        const justification = (row.justification || row.businessJustification || row.reason || "Bulk uploaded requisition").trim();
        const supplierName = (row.supplier || row.supplierName || "").trim();
        const glAccount = (row.glAccount || row.gl_account || row.gl || "6100").trim();
        const deliveryLocation = (row.deliveryLocation || row.delivery_location || row.location || "").trim() || null;

        // Find supplier if provided
        let supplierId: string|undefined;
        if (supplierName) {
          const sup = await prisma.supplier.findFirst({
            where: { organizationId, name: { contains: supplierName, mode: "insensitive" } }
          });
          supplierId = sup?.id;
        }

        // API-sourced uploads have no session user — resolve a requestor from
        // the row (or fall back to the org's first admin) since it's required.
        let requestorId = auth.actor.userId;
        if (!requestorId) {
          const requestorEmail = (row.requestorEmail || row.requestor_email || "").trim().toLowerCase();
          const requestor = requestorEmail
            ? await prisma.user.findFirst({ where: { organizationId, email: requestorEmail } })
            : await prisma.user.findFirst({ where: { organizationId, role: "ADMIN" }, orderBy: { createdAt: "asc" } });
          if (!requestor) { results.errors.push(`"${title}": no requestor found — set requestorEmail or invite an admin`); continue; }
          requestorId = requestor.id;
        }

        idx++;
        const num = "REQ-" + String(idx).padStart(4, "0");
        const tax = amount * 0.18;

        const req2 = await prisma.requisition.create({
          data: {
            organizationId, requestorId,
            requisitionNumber: num, title, category,
            priority: ["HIGH","MEDIUM","LOW","CRITICAL"].includes(priority) ? priority : "MEDIUM",
            status: "DRAFT", currency: "INR",
            subtotal: amount, totalTax: tax, totalAmount: amount + tax,
            department, businessJustification: justification,
            deliveryLocation,
          },
        });

        if (amount > 0) {
          await prisma.requisitionLineItem.create({
            data: {
              requisitionId: req2.id, description: title,
              quantity: parseFloat(row.quantity || "1") || 1,
              unitPrice: amount, lineTotal: amount,
              taxRate: 0.18, taxAmount: tax,
              glAccount, supplierId,
            },
          });
        }
        results.created++;
      } catch (e: any) {
        results.errors.push(`"${row.title || "Row"}": ${e.message?.split("\n")[0]}`);
      }
    }

    return NextResponse.json(results);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
