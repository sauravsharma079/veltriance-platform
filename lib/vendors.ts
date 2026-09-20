import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

/**
 * A vendor you don't already have gets registered as a Supplier in "Pending approval / Registration"
 * — the same starting point as adding one under Suppliers — so it enters the normal onboarding and
 * risk process automatically. Sourcing and contracts used to accept a vendor as a bare name and
 * email, which let new vendors be awarded and contracted without ever being onboarded.
 *
 * Returns the existing supplier when the same email or name is already on file, rather than
 * creating a duplicate.
 */
export async function registerNewVendor(opts: {
  organizationId: string;
  actor: { id: string; name: string };
  name: string;
  email: string;
  contactName?: string | null;
  category?: string | null;
  source: string; // where they came from, e.g. "Sourcing RFX-2026-00001"
}): Promise<{ supplier: { id: string; name: string; status: string; onboardingStage: string | null }; created: boolean }> {
  const email = opts.email.trim().toLowerCase();
  const name = opts.name.trim();
  const existing = await prisma.supplier.findFirst({
    where: { organizationId: opts.organizationId, OR: [{ contactEmail: { equals: email, mode: "insensitive" } }, { name: { equals: name, mode: "insensitive" } }] },
    select: { id: true, name: true, status: true, onboardingStage: true },
  });
  if (existing) return { supplier: existing, created: false };

  const count = await prisma.supplier.count({ where: { organizationId: opts.organizationId } });
  let code = `SUP-${String(count + 101).padStart(3, "0")}`;
  for (let n = count + 102; n < count + 120 && (await prisma.supplier.findFirst({ where: { organizationId: opts.organizationId, code }, select: { id: true } })); n++) code = `SUP-${String(n).padStart(3, "0")}`;

  const supplier = await prisma.supplier.create({
    data: {
      organizationId: opts.organizationId, name, code, status: "PENDING_APPROVAL", onboardingStage: "REGISTRATION",
      contactEmail: email, contactName: opts.contactName ?? null, category: opts.category ?? null,
      requestedById: opts.actor.id, notes: `New vendor — ${opts.source}. Onboarding required before any contract is signed or order placed.`,
    },
    select: { id: true, name: true, status: true, onboardingStage: true },
  });
  await logAudit({
    organizationId: opts.organizationId, userId: opts.actor.id, userName: opts.actor.name,
    action: "CREATED", entity: "SUPPLIER", entityId: supplier.id, entityLabel: supplier.name, details: { source: opts.source, newVendor: true },
  });
  return { supplier, created: true };
}

export type VendorReadiness = { ready: true } | { ready: false; reason: string };

/**
 * Whether we may bind ourselves to this vendor (sign a contract with them, place an order).
 * Only an Active supplier — one that has finished onboarding and been approved — qualifies.
 * `allowPending` is for agreements that are normally signed before onboarding, like an NDA.
 */
export function vendorReadiness(
  supplier: { name: string; status: string; onboardingStage: string | null } | null | undefined,
  opts: { allowPending?: boolean } = {},
): VendorReadiness {
  if (!supplier) return { ready: false, reason: "No supplier is linked. Link one — for a new vendor, add them so they go through supplier onboarding." };
  if (supplier.status === "BLOCKED" || supplier.status === "INACTIVE") return { ready: false, reason: `${supplier.name} is ${supplier.status.toLowerCase()} and can't be contracted or ordered from.` };
  if (supplier.status === "ACTIVE") return { ready: true };
  if (opts.allowPending) return { ready: true };
  const stage = supplier.onboardingStage ? supplier.onboardingStage.toLowerCase().replace(/_/g, " ") : "registration";
  return { ready: false, reason: `${supplier.name} hasn't completed supplier onboarding yet (currently: ${stage}). Finish onboarding and get them approved under Suppliers first.` };
}
