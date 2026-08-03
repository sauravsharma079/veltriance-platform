import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { canEditSupplier } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

// Fields a caller may edit on a supplier record. Anything else in the request
// body is ignored rather than passed straight to Prisma — the previous
// PATCH had zero allowlist AND zero permission check, so any authenticated
// org member could rewrite any supplier's bank details.
const EDITABLE_FIELDS = [
  "name", "code", "taxId", "dunsNumber", "website", "description", "tier",
  "addressLine1", "addressLine2", "city", "state", "postalCode", "country",
  "contactName", "contactEmail", "contactPhone", "paymentTerms", "currency",
  "bankName", "bankAccountNumber", "bankRoutingNumber", "category", "subcategory",
  "diversityStatus", "preferred", "status", "notes",
  "poTransmissionMethod", "cxmlEndpoint", "assignedUserId",
] as const;

export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const profile = await prisma.user.findUnique({ where: { authId: user.id } });
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const supplier = await prisma.supplier.findFirst({
      where: { id, organizationId: org.id },
      include: { contacts: true, assignedUser: { select: { id: true, name: true } } },
    });
    if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const canEdit = await canEditSupplier(profile, supplier);
    return NextResponse.json({ supplier, canEdit });
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const profile = await prisma.user.findUnique({ where: { authId: user.id } });
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const existing = await prisma.supplier.findFirst({ where: { id, organizationId: org.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!(await canEditSupplier(profile, existing)))
      return NextResponse.json({ error: "You don't have permission to edit this supplier — ask an admin to grant the Suppliers edit permission, or assign you as its owner." }, { status: 403 });

    const body = await req.json();
    const data: Record<string, unknown> = {};
    for (const key of EDITABLE_FIELDS) {
      if (body[key] !== undefined) data[key] = body[key];
    }

    const supplier = await prisma.supplier.update({ where: { id, organizationId: org.id }, data });

    await logAudit({
      organizationId: org.id, userId: profile.id, userName: profile.name,
      action: "UPDATED", entity: "SUPPLIER", entityId: id, entityLabel: supplier.name,
      details: { fields: Object.keys(data) },
    });

    return NextResponse.json({ supplier });
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}
