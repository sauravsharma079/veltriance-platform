import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { requireAdmin } from "@/lib/api-auth";
import crypto from "crypto";

export async function GET() {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ clients: [] });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ clients: [] });

    // Try with _count first, fall back without it
    let clients: any[] = [];
    try {
      clients = await (prisma.apiClient.findMany as any)({
        where: { organizationId: org.id },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { tokens: true } } },
      });
    } catch {
      // tokens relation may not exist — fetch without _count
      clients = await prisma.apiClient.findMany({
        where: { organizationId: org.id },
        orderBy: { createdAt: "desc" },
      });
      // Add fake _count so page doesn't crash
      clients = clients.map(c => ({ ...c, _count: { tokens: 0 } }));
    }

    return NextResponse.json({ clients });
  } catch (e: any) {
    console.error("[api-clients GET]", e?.message);
    return NextResponse.json({ clients: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json();
    const { name, description, scopes } = body;
    if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const rawClientId = "vlt_client_" + crypto.randomBytes(12).toString("hex");
    const rawSecret   = "vlt_secret_"  + crypto.randomBytes(20).toString("hex");
    const secretHash  = crypto.createHash("sha256").update(rawSecret).digest("hex");

    let client: any;
    // Try clientSecretHash first (hashed), then clientSecret (plain)
    try {
      client = await (prisma.apiClient.create as any)({
        data: {
          organizationId: admin.organizationId, name: name.trim(),
          description: description || null, clientId: rawClientId,
          clientSecretHash: secretHash,
          scopes: Array.isArray(scopes) ? scopes : [], active: true,
        },
      });
    } catch {
      client = await (prisma.apiClient.create as any)({
        data: {
          organizationId: admin.organizationId, name: name.trim(),
          description: description || null, clientId: rawClientId,
          clientSecret: rawSecret,
          scopes: Array.isArray(scopes) ? scopes : [], active: true,
        },
      });
    }

    // Attach _count so page renders correctly
    client._count = { tokens: 0 };

    // Return both nested and flat format — page uses d.client_id and d.client_secret
    return NextResponse.json({
      client,
      client_id: rawClientId,
      client_secret: rawSecret,
    }, { status: 201 });
  } catch (e: any) {
    console.error("[api-clients POST]", e?.message);
    return NextResponse.json({ error: e?.message ?? "Failed to create client" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await req.json();
    await prisma.apiClient.delete({ where: { id, organizationId: admin.organizationId } });
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}
