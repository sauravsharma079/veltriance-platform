import { NextResponse } from "next/server";
import type { LicenseModule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MODULE_CATALOG } from "@/lib/license-catalog";

type LicensedOrg = { licensedModules: LicenseModule[]; licenseExpiresAt: Date | null };

export function isLicenseExpired(org: Pick<LicensedOrg, "licenseExpiresAt">): boolean {
  return !!org.licenseExpiresAt && org.licenseExpiresAt.getTime() < Date.now();
}

/** Modules the org may use right now — none once the license has expired. */
export function activeModules(org: LicensedOrg): LicenseModule[] {
  return isLicenseExpired(org) ? [] : org.licensedModules;
}

export function hasModule(org: LicensedOrg, module: LicenseModule): boolean {
  return activeModules(org).includes(module);
}

/**
 * For API routes: returns a 403 response when the org isn't licensed for the
 * module, or null when the request may proceed.
 *
 *   const blocked = moduleGuard(org, "SUPPLIER_RISK");
 *   if (blocked) return blocked;
 */
export function moduleGuard(org: LicensedOrg, module: LicenseModule): NextResponse | null {
  if (hasModule(org, module)) return null;
  const expired = isLicenseExpired(org);
  return NextResponse.json({
    error: expired
      ? "Your license has expired. Contact your account manager to renew."
      : `${MODULE_CATALOG[module].label} isn't included in your license.`,
    code: expired ? "LICENSE_EXPIRED" : "MODULE_NOT_LICENSED",
    module,
  }, { status: 403 });
}

/** Seats in use (every user row, including pending invites) against the org's limit. */
export async function seatUsage(organizationId: string) {
  const [org, used] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { seatLimit: true } }),
    prisma.user.count({ where: { organizationId } }),
  ]);
  const limit = org?.seatLimit ?? null;
  return { used, limit, remaining: limit === null ? Infinity : Math.max(limit - used, 0) };
}

/** 403 when adding `adding` users would exceed the seat limit, else null. */
export async function seatGuard(organizationId: string, adding = 1): Promise<NextResponse | null> {
  const { used, limit, remaining } = await seatUsage(organizationId);
  if (remaining >= adding) return null;
  return NextResponse.json({
    error: `Your license allows ${limit} users and ${used} are in use. Contact your account manager to add seats.`,
    code: "SEAT_LIMIT_REACHED",
  }, { status: 403 });
}
