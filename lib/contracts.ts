import { createHash, randomBytes } from "crypto";
import type { ContractStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const CONTRACT_TYPES = ["MSA", "NDA", "SOW", "PURCHASE_AGREEMENT", "SLA", "OTHER"] as const;

/** Who may move a contract where. Anything not listed is not allowed. */
export const TRANSITIONS: Record<string, { from: ContractStatus[]; to: ContractStatus }> = {
  share:              { from: ["DRAFT"],                                to: "NEGOTIATION" },
  submit:             { from: ["DRAFT", "NEGOTIATION"],                 to: "PENDING_APPROVAL" },
  return:             { from: ["PENDING_APPROVAL"],                     to: "DRAFT" },
  approve:            { from: ["PENDING_APPROVAL"],                     to: "PENDING_SIGNATURE" },
  // Pulls a contract back out of signature (e.g. to fix the supplier); earlier signatures are voided.
  withdraw:           { from: ["PENDING_SIGNATURE"],                   to: "DRAFT" },
  cancel:             { from: ["DRAFT", "NEGOTIATION", "PENDING_APPROVAL", "PENDING_SIGNATURE"], to: "CANCELLED" },
  terminate:          { from: ["ACTIVE"],                               to: "TERMINATED" },
};

/** Text can only change while the parties are still drafting or negotiating. */
export const EDITABLE: ContractStatus[] = ["DRAFT", "NEGOTIATION"];

export async function nextContractNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.contract.count({ where: { organizationId, contractNumber: { startsWith: `CON-${year}-` } } });
  return `CON-${year}-${String(count + 1).padStart(5, "0")}`;
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** A new signing link: the raw token goes to the signatory, only its hash is stored. */
export function newSigningToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: sha256(token) };
}

/**
 * The address to put in links sent to outsiders (signers, bidders). It is the canonical
 * public domain — not whichever address the buyer happened to be on (Vercel's own
 * *.vercel.app address, a preview URL) and not NEXT_PUBLIC_APP_URL, which points at
 * the Vercel address in this deployment. Local development keeps using localhost.
 */
export function publicBaseUrl(requestOrigin?: string): string {
  if (requestOrigin && /^https?:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(requestOrigin)) return requestOrigin.replace(/\/$/, "");
  const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "app.veltriance.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${root}`;
}

export function signingUrl(token: string, fallbackOrigin?: string): string {
  return `${publicBaseUrl(fallbackOrigin)}/sign/${token}`;
}

/** Moves ACTIVE contracts past their end date to EXPIRED. Deterministic — no model involved. */
export async function expireContracts(organizationId?: string) {
  const res = await prisma.contract.updateMany({
    where: { status: "ACTIVE", endDate: { lt: new Date() }, autoRenew: false, ...(organizationId && { organizationId }) },
    data: { status: "EXPIRED" },
  });
  return res.count;
}
