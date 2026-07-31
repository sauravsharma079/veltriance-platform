import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ suppliers: [] });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ suppliers: [] });
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const status = req.nextUrl.searchParams.get("status");
    const stage = req.nextUrl.searchParams.get("stage");
    const suppliers = await prisma.supplier.findMany({
      where: {
        organizationId: org.id,
        ...(status ? { status: status as any } : {}),
        ...(stage ? { onboardingStage: stage as any } : {}),
        ...(q ? { OR: [
          { name: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
          { category: { contains: q, mode: "insensitive" } },
        ]} : {}),
      },
      orderBy: [{ preferred: "desc" }, { name: "asc" }],
      take: 200,
    });
    return NextResponse.json({ suppliers });
  } catch (e: any) {
    console.error("[suppliers GET]", e?.message);
    return NextResponse.json({ suppliers: [] });
  }
}
export async function PATCH(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await req.json();
    const { id, ...data } = body;
    const supplier = await prisma.supplier.update({ where: { id, organizationId: org.id }, data });
    return NextResponse.json({ supplier });
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}
export async function POST(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const profile = await prisma.user.findUnique({ where: { authId: user.id } });
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    const body = await req.json();
    const count = await prisma.supplier.count({ where: { organizationId: org.id } });
    const code = `SUP-${String(count + 101).padStart(3, "0")}`;
    const supplier = await prisma.supplier.create({
      data: { organizationId: org.id, name: body.name, code, status: "PENDING_APPROVAL",
        onboardingStage: "REGISTRATION", contactEmail: body.contactEmail ?? null,
        contactName: body.contactName ?? null, category: body.category ?? null,
        city: body.city ?? null, contactPhone: body.contactPhone ?? null,
        country: body.country ?? "India", currency: body.currency ?? "INR", requestedById: profile.id },
    });
    return NextResponse.json({ supplier }, { status: 201 });
  } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 500 }); }
}
