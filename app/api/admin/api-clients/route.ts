// ─── FILE 1: app/api/admin/lookups/route.ts ───────────────────────────────────
// CHANGE: Add ?type= filter support so IntakeBot can fetch DELIVERY_ADDRESS
// Replace the existing GET handler with this:

/*
export async function GET(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ lookups: [] });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ lookups: [] });
    const type = req.nextUrl.searchParams.get("type");   // <-- ADD THIS LINE
    const lookups = await prisma.lookup.findMany({
      where: {
        organizationId: org.id,
        isActive: true,
        ...(type ? { type } : {}),                       // <-- ADD THIS LINE
      },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
    });
    return NextResponse.json({ lookups });
  } catch { return NextResponse.json({ lookups: [] }); }
}
*/

// ─── FILE 2: app/api/admin/api-clients/route.ts ───────────────────────────────
// FULL REPLACEMENT — also generates clientId and clientSecret on creation

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import crypto from "crypto";

function generateId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(16).toString("hex")}`;
}

export async function GET() {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ clients: [] });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ clients: [] });
    const clients = await prisma.apiClient.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { tokens: true } } },
    });
    return NextResponse.json({ clients });
  } catch (e: any) {
    console.error("[api-clients GET]", e?.message);
    return NextResponse.json({ clients: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    const profile = await prisma.user.findUnique({ where: { authId: user.id } });
    if (!profile || profile.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const body = await req.json();
    const { name, description, scopes, grantType } = body;
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const clientId = generateId("vlt_client");
    const clientSecret = generateId("vlt_secret");

    const client = await prisma.apiClient.create({
      data: {
        organizationId: org.id,
        name: name.trim(),
        description: description ?? null,
        clientId,
        clientSecret,
        scopes: Array.isArray(scopes) ? scopes : [],
        active: true,
        grantTypes: grantType ? [grantType] : ["client_credentials"],
      },
    });
    // Return secret ONCE — cannot be recovered after this
    return NextResponse.json({ client: { ...client, clientSecret } }, { status: 201 });
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
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
