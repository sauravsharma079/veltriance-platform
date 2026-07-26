import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

async function getCtx() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const [profile, org] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !org || profile.organizationId !== org.id) return null;
  return { profile, org };
}

export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const where: Record<string, unknown> = { organizationId: ctx.org.id };
  const s = url.searchParams.get("status");
  const c = url.searchParams.get("category");
  const q = url.searchParams.get("q");
  if (s) where.status   = s;
  if (c) where.category = { contains: c, mode: "insensitive" };
  if (q) where.name     = { contains: q, mode: "insensitive" };
  const suppliers = await prisma.supplier.findMany({
    where, orderBy: { createdAt: "desc" },
    include: {
      onboardingProfile: { select: { completionScore: true, gstNumber: true, panNumber: true } },
      _count: { select: { documents: true } },
    },
  });
  return NextResponse.json({ suppliers });
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.name || !String(body.name).trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 422 });
  }
  const count = await prisma.supplier.count({ where: { organizationId: ctx.org.id } });
  const supplier = await prisma.supplier.create({
    data: {
      organizationId: ctx.org.id,
      name: String(body.name).trim(),
      code: `SUP-${String(count + 1).padStart(3, "0")}`,
      contactEmail:  (body.contactEmail  as string) || null,
      contactName:   (body.contactName   as string) || null,
      contactPhone:  (body.contactPhone  as string) || null,
      category:      (body.category      as string) || null,
      website:       (body.website       as string) || null,
      city:          (body.city          as string) || null,
      country:       (body.country       as string) || "India",
      currency:      "INR",
      status:        "PENDING_APPROVAL",
      onboardingStage: "REGISTRATION",
      businessJustification: (body.businessJustification as string) || null,
      requestedById: ctx.profile.id,
    },
  });
  return NextResponse.json({ supplier }, { status: 201 });
}
