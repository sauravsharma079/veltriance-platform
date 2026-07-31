import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { buildPunchOutSetupRequest, parsePunchOutSetupResponse } from "@/lib/cxml";

/**
 * POST /api/punchout/[catalogId]/setup
 *
 * Kicks off a cXML punchout session: builds and sends a PunchOutSetupRequest
 * to the supplier's punchout URL, and returns the StartPage URL the client
 * should navigate the user's browser to. The supplier will later POST the
 * resulting cart back to /api/punchout/[catalogId]/return, correlated via
 * the BuyerCookie generated here (not via session/cookie — see that route).
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ catalogId: string }> }) {
  try {
    const { catalogId } = await ctx.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [profile, organization] = await Promise.all([
      prisma.user.findUnique({ where: { authId: user.id } }),
      getCurrentOrganization(),
    ]);
    if (!profile || !organization || profile.organizationId !== organization.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const catalog = await prisma.catalog.findFirst({ where: { id: catalogId, organizationId: organization.id } });
    if (!catalog) return NextResponse.json({ error: "Catalog not found" }, { status: 404 });
    if (catalog.type !== "PUNCHOUT") return NextResponse.json({ error: "Not a punchout catalog" }, { status: 422 });
    if (catalog.status !== "ACTIVE") return NextResponse.json({ error: "This punchout connection is inactive" }, { status: 422 });
    if (!catalog.punchoutUrl) return NextResponse.json({ error: "No punchout URL configured for this catalog" }, { status: 422 });

    const buyerCookie = `vlt-po-${randomUUID()}`;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(_req.url).origin;

    const session = await prisma.punchoutSession.create({
      data: {
        organizationId: organization.id,
        catalogId: catalog.id,
        requestorId: profile.id,
        buyerCookie,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
    });

    const cxmlPayload = buildPunchOutSetupRequest({
      buyerCookie,
      fromDomain: catalog.cxmlFromDomain || "NetworkId",
      fromIdentity: catalog.cxmlFromIdentity || organization.name,
      toDomain: catalog.cxmlToDomain || "NetworkId",
      toIdentity: catalog.cxmlToIdentity || catalog.name,
      senderDomain: catalog.cxmlSenderDomain || catalog.cxmlFromDomain || "NetworkId",
      senderIdentity: catalog.cxmlSenderIdentity || catalog.cxmlFromIdentity || organization.name,
      sharedSecret: catalog.cxmlSharedSecret || "",
      browserFormPostUrl: `${baseUrl}/api/punchout/${catalog.id}/return`,
      userEmail: profile.email,
    });

    const response = await fetch(catalog.punchoutUrl, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      body: cxmlPayload,
    }).catch(() => null);

    if (!response) {
      await prisma.punchoutSession.update({ where: { id: session.id }, data: { status: "ERROR", errorMessage: "Network error reaching supplier punchout URL" } });
      return NextResponse.json({ error: "Could not reach the supplier's punchout URL" }, { status: 502 });
    }

    const responseXml = await response.text();
    const result = parsePunchOutSetupResponse(responseXml);

    if (result.ok === false) {
      const { statusCode, statusText } = result;
      await prisma.punchoutSession.update({ where: { id: session.id }, data: { status: "ERROR", errorMessage: `${statusCode}: ${statusText}` } });
      return NextResponse.json({ error: `Supplier rejected the punchout request: ${statusText}` }, { status: 502 });
    }

    await prisma.punchoutSession.update({ where: { id: session.id }, data: { startPageUrl: result.startPageUrl } });

    return NextResponse.json({ redirectUrl: result.startPageUrl });
  } catch (e: any) {
    console.error("[punchout setup]", e?.message);
    return NextResponse.json({ error: e?.message ?? "Failed to start punchout session" }, { status: 500 });
  }
}
