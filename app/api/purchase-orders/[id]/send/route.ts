import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { sendPurchaseOrder } from "@/lib/po-send";

/**
 * POST /api/purchase-orders/[id]/send
 *
 * Manual "Send" action for a DRAFT PO — used as a fallback when automatic
 * transmission (right after requisition approval) couldn't complete, e.g. no
 * supplier email on file yet. See lib/po-send.ts for the actual EMAIL / cXML /
 * MANUAL delivery logic, shared with the auto-send and change-order paths.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const body = await req.json().catch(() => ({}));
  const method = body?.method as "EMAIL" | "CXML" | "MANUAL" | undefined;

  const result = await sendPurchaseOrder({
    poId: id,
    organizationId: organization.id,
    supabase,
    method,
    supplierEmailOverride: body?.supplierEmail,
    actorName: profile.name,
    actorId: profile.id,
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ success: true, method: result.method, detail: result.detail });
}
