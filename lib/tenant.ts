import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { TENANT_HEADER } from "@/lib/constants";

/** The subdomain segment for the current request, or null if we're on the root domain. */
export async function getCurrentSlug(): Promise<string | null> {
  const headersList = await headers();
  const slug = headersList.get(TENANT_HEADER);
  return slug && slug.length > 0 ? slug : null;
}

/**
 * Resolves the current request's subdomain to an Organization row.
 * Returns null if we're on the root domain, or if the subdomain doesn't
 * match any organization (caller should show a "workspace not found" state).
 */
export async function getCurrentOrganization() {
  const slug = await getCurrentSlug();
  if (!slug) return null;
  return prisma.organization.findUnique({ where: { slug } });
}

/** Slug validation shared by the create-organization form and the API route. */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(slug);
}

const RESERVED_SLUGS = ["www", "app", "api", "admin", "dashboard", "login", "signup", "auth"];

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase());
}
