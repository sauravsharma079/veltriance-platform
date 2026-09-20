import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { errorMessage } from "@/lib/errors";
import { onboardingAccess } from "@/lib/supplier-access";
import { sendVendorPortalInvite } from "@/lib/vendor-portal";

/** Sends (or re-sends) a vendor their personal onboarding link. Any earlier link stops working. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await onboardingAccess();
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const supplier = await prisma.supplier.findFirst({ where: { id, organizationId: a.org.id }, select: { id: true, name: true, status: true } });
  if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (supplier.status !== "PENDING_APPROVAL") return NextResponse.json({ error: supplier.status === "ACTIVE" ? "This supplier is already approved." : `A ${supplier.status.toLowerCase()} supplier can't be onboarded.` }, { status: 422 });
  try {
    const invite = await sendVendorPortalInvite({ supplierId: id, orgName: a.org.name, origin: new URL(req.url).origin, requestedBy: a.profile.name });
    await logAudit({ organizationId: a.org.id, userId: a.profile.id, userName: a.profile.name, action: "SENT", entity: "SUPPLIER", entityId: id, entityLabel: supplier.name, details: { onboardingLink: true, emailed: invite.emailed } });
    return NextResponse.json({ invite });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 422 });
  }
}
