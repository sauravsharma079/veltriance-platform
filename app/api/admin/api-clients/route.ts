import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import crypto from "crypto";
export async function GET() {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ clients: [] });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ clients: [] });
    const clients = await prisma.apiClient.findMany({ where: { organizationId: org.id }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ clients });
  } catch { return NextResponse.json({ clients: [] }); }
}
export async function POST(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { name, description, scopes } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
    const rawClientId = "vlt_client_" + crypto.randomBytes(12).toString("hex");
    const rawSecret   = "vlt_secret_"  + crypto.randomBytes(20).toString("hex");
    const secretHash  = crypto.createHash("sha256").update(rawSecret).digest("hex");
    let client: any;
    try {
      client = await prisma.apiClient.create({ data: { organizationId: org.id, name: name.trim(), description: description || null, clientId: rawClientId, clientSecretHash: secretHash, scopes: Array.isArray(scopes) ? scopes : [], active: true } as any });
    } catch {
      client = await prisma.apiClient.create({ data: { organizationId: org.id, name: name.trim(), description: description || null, clientId: rawClientId, clientSecret: rawSecret, scopes: Array.isArray(scopes) ? scopes : [], active: true } as any });
    }
    // Return BOTH formats so developer page works
    return NextResponse.json({ client, client_id: rawClientId, client_secret: rawSecret }, { status: 201 });
  } catch (e: any) {
    console.error("[api-clients POST]", e?.message);
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
export async function DELETE(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { id } = await req.json();
    await prisma.apiClient.delete({ where: { id, organizationId: org.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}
