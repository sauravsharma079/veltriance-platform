import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import crypto from "crypto";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await req.json();

    if (body.rotate_secret) {
      const rawSecret = "vlt_secret_" + crypto.randomBytes(20).toString("hex");
      const secretHash = crypto.createHash("sha256").update(rawSecret).digest("hex");
      let client: any;
      try {
        client = await (prisma.apiClient.update as any)({
          where: { id, organizationId: org.id },
          data: { clientSecretHash: secretHash },
        });
      } catch {
        client = await (prisma.apiClient.update as any)({
          where: { id, organizationId: org.id },
          data: { clientSecret: rawSecret },
        });
      }
      client._count = { tokens: 0 };
      return NextResponse.json({ client, client_secret: rawSecret });
    }

    // Toggle active
    const client = await prisma.apiClient.update({
      where: { id, organizationId: org.id },
      data: { active: body.active },
    });
    return NextResponse.json({ client: { ...client, _count: { tokens: 0 } } });
  } catch (e: any) {
    console.error("[api-clients PATCH]", e?.message);
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.apiClient.delete({ where: { id, organizationId: org.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
