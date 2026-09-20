import { prisma } from "@/lib/prisma";
import { EDITABLE } from "@/lib/contracts";

export class VersionError extends Error {}

/**
 * Appends a new version to a contract. Shared by the editor, the supplier's
 * counter-proposal and the negotiation agent so all three obey the same rules:
 * only while DRAFT/NEGOTIATION, only if the text actually changed, and safe
 * against two writers racing (the version number is claimed atomically).
 */
export async function createVersion(opts: {
  contractId: string; organizationId: string; body: string; changeNote?: string;
  source: "HUMAN" | "AGENT" | "SUPPLIER"; by: { id?: string; name: string };
}) {
  return prisma.$transaction(async tx => {
    const contract = await tx.contract.findFirst({ where: { id: opts.contractId, organizationId: opts.organizationId }, select: { status: true, currentVersion: true } });
    if (!contract) throw new VersionError("Contract not found");
    if (!EDITABLE.includes(contract.status)) throw new VersionError(`The text is locked while a contract is ${contract.status.replace("_", " ").toLowerCase()}`);
    const current = await tx.contractVersion.findUnique({ where: { contractId_versionNumber: { contractId: opts.contractId, versionNumber: contract.currentVersion } }, select: { body: true } });
    if (current && current.body.trim() === opts.body.trim()) throw new VersionError("No changes from the current version");

    // Claim the next number only if nobody else moved it since we read it.
    const claimed = await tx.contract.updateMany({
      where: { id: opts.contractId, currentVersion: contract.currentVersion },
      data: { currentVersion: { increment: 1 } },
    });
    if (claimed.count === 0) throw new VersionError("The contract was just changed by someone else — reload and try again");
    return tx.contractVersion.create({
      data: {
        contractId: opts.contractId, versionNumber: contract.currentVersion + 1, body: opts.body,
        changeNote: opts.changeNote ?? null, source: opts.source, createdById: opts.by.id ?? null, createdByName: opts.by.name,
      },
    });
  });
}
