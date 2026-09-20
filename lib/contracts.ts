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

export function signingUrl(token: string, fallbackOrigin?: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || fallbackOrigin || "https://app.veltriance.com").replace(/\/$/, "");
  return `${base}/sign/${token}`;
}

/** Moves ACTIVE contracts past their end date to EXPIRED. Deterministic — no model involved. */
export async function expireContracts(organizationId?: string) {
  const res = await prisma.contract.updateMany({
    where: { status: "ACTIVE", endDate: { lt: new Date() }, autoRenew: false, ...(organizationId && { organizationId }) },
    data: { status: "EXPIRED" },
  });
  return res.count;
}
