import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getMemberOrganization } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { errorMessage } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ suppliers: [] });
    const org = await getMemberOrganization(user.id);
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
  } catch (e) {
    console.error("[suppliers GET]", errorMessage(e));
    return NextResponse.json({ suppliers: [] });
  }
}
export async function POST(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const org = await getMemberOrganization(user.id);
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
    await logAudit({
      organizationId: org.id, userId: profile.id, userName: profile.name,
      action: "CREATED", entity: "SUPPLIER", entityId: supplier.id, entityLabel: supplier.name,
    });
    return NextResponse.json({ supplier }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: errorMessage(e) }, { status: 500 }); }
}
