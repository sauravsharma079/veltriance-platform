import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { seatUsage } from "@/lib/licensing";
import { ALL_MODULES, PLANS } from "@/lib/license-catalog";

/**
 * Platform-operator API for granting and changing a customer's license.
 * Deliberately separate from the customer's own admin: a customer must never be
 * able to give itself modules or seats. Guarded by the PLATFORM_ADMIN_SECRET
 * env var; if that isn't set the endpoint doesn't exist.
 *
 *   curl -X PUT $APP/api/platform/organizations/acme/license \
 *     -H "Authorization: Bearer $PLATFORM_ADMIN_SECRET" -H "Content-Type: application/json" \
 *     -d '{"plan":"FULL_SUITE","licenseExpiresAt":"2027-09-30","seatLimit":250}'
 */
function isOperator(req: NextRequest): boolean {
  const secret = process.env.PLATFORM_ADMIN_SECRET;
  if (!secret) return false;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const a = Buffer.from(given), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const putSchema = z.object({
  plan: z.string().refine(p => p === "CUSTOM" || p in PLANS, "Unknown plan").optional(),
  modules: z.array(z.enum(ALL_MODULES as [string, ...string[]])).min(1).optional(),
  licenseExpiresAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
  seatLimit: z.number().int().positive().nullable().optional(),
}).refine(d => d.plan !== "CUSTOM" || d.modules, { message: "modules are required for a CUSTOM plan" });

async function loadOrg(slug: string) {
  return prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, plan: true, licensedModules: true, licenseExpiresAt: true, seatLimit: true },
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  if (!isOperator(req)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const org = await loadOrg((await ctx.params).slug);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const seats = await seatUsage(org.id);
  return NextResponse.json({ license: org, seatsUsed: seats.used });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  if (!isOperator(req)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const org = await loadOrg((await ctx.params).slug);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 });
  const d = parsed.data;

  // A named plan brings its modules; explicit modules without a plan make it CUSTOM.
  const plan = d.plan ?? (d.modules ? "CUSTOM" : undefined);
  const modules = (d.modules ?? (plan && plan !== "CUSTOM" ? PLANS[plan].modules : undefined)) as typeof org.licensedModules | undefined;

  if (d.seatLimit) {
    const { used } = await seatUsage(org.id);
    if (d.seatLimit < used)
      return NextResponse.json({ error: `${used} seats are already in use — the limit can't be set below that.` }, { status: 422 });
  }

  const updated = await prisma.organization.update({
    where: { id: org.id },
    data: {
      ...(plan !== undefined && { plan }),
      ...(modules !== undefined && { licensedModules: modules }),
      ...(d.licenseExpiresAt !== undefined && { licenseExpiresAt: d.licenseExpiresAt ? new Date(d.licenseExpiresAt) : null }),
      ...(d.seatLimit !== undefined && { seatLimit: d.seatLimit }),
    },
    select: { plan: true, licensedModules: true, licenseExpiresAt: true, seatLimit: true },
  });

  await logAudit({
    organizationId: org.id, userName: "Platform operator",
    action: "UPDATED", entity: "LICENSE", entityId: org.id, entityLabel: org.name,
    details: { before: { plan: org.plan, modules: org.licensedModules, expires: org.licenseExpiresAt, seats: org.seatLimit }, after: updated },
  });
  return NextResponse.json({ license: updated });
}
