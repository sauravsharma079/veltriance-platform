import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sha256 } from "@/lib/contracts";
import { createVersion, VersionError } from "@/lib/contract-versions";
import { vendorReadiness } from "@/lib/vendors";

/**
 * Unauthenticated endpoint behind the personal signing/review link. The token
 * is 256 bits of randomness and only its hash is stored, so it can't be
 * guessed. It exposes ONE contract, and never internal notes, other parties'
 * links or anything from elsewhere in the workspace.
 */
async function load(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const signatory = await prisma.contractSignatory.findUnique({
    where: { tokenHash: sha256(token) },
    include: { contract: { include: { organization: { select: { name: true } }, supplier: { select: { name: true, status: true, onboardingStage: true } }, signatories: { select: { id: true, status: true } } } } },
  });
  if (!signatory) return null;
  return { signatory, contract: signatory.contract };
}

const HIDDEN = ["DRAFT", "CANCELLED", "PENDING_APPROVAL"]; // not yet (or no longer) shared with outsiders

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const found = await load((await ctx.params).token);
  if (!found || HIDDEN.includes(found.contract.status)) return NextResponse.json({ error: "This link isn't valid any more" }, { status: 404 });
  const { signatory, contract } = found;
  const [version, comments] = await Promise.all([
    prisma.contractVersion.findUnique({ where: { contractId_versionNumber: { contractId: contract.id, versionNumber: contract.currentVersion } }, select: { body: true, versionNumber: true } }),
    prisma.contractComment.findMany({ where: { contractId: contract.id, internal: false }, orderBy: { createdAt: "asc" }, select: { id: true, authorType: true, authorName: true, body: true, createdAt: true } }),
  ]);
  return NextResponse.json({
    organization: contract.organization.name,
    contract: { title: contract.title, contractNumber: contract.contractNumber, type: contract.type, status: contract.status, value: contract.value, currency: contract.currency, startDate: contract.startDate, endDate: contract.endDate, publishedAt: contract.publishedAt },
    you: { name: signatory.name, party: signatory.party, status: signatory.status, signedAt: signatory.signedAt },
    version: version?.versionNumber, body: version?.body ?? "", comments,
    // Even if it was approved earlier, nobody can sign while the vendor is still un-onboarded.
    canSign: contract.status === "PENDING_SIGNATURE" && signatory.status === "PENDING" && vendorReadiness(contract.supplier, { allowPending: contract.type === "NDA" }).ready,
    holdReason: contract.status === "PENDING_SIGNATURE" && vendorReadiness(contract.supplier, { allowPending: contract.type === "NDA" }).ready === false ? "This agreement can't be signed yet — supplier onboarding hasn't been completed. You'll be told when it's ready." : null,
    canNegotiate: contract.status === "NEGOTIATION" && signatory.party === "SUPPLIER",
    canComment: ["NEGOTIATION", "PENDING_SIGNATURE"].includes(contract.status),
  });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("comment"), body: z.string().trim().min(1).max(5000) }),
  z.object({ action: z.literal("counter"), body: z.string().min(1).max(200_000), note: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal("sign"), typedName: z.string().trim().min(2).max(120), agree: z.literal(true) }),
  z.object({ action: z.literal("decline"), reason: z.string().trim().min(3).max(1000) }),
]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const found = await load((await ctx.params).token);
  if (!found || HIDDEN.includes(found.contract.status)) return NextResponse.json({ error: "This link isn't valid any more" }, { status: 404 });
  const { signatory, contract } = found;
  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 });
  const d = parsed.data;
  const authorType = signatory.party;
  const audit = (action: "UPDATED" | "APPROVED" | "REJECTED", details: Record<string, unknown>) =>
    logAudit({ organizationId: contract.organizationId, userName: `${signatory.name} (${signatory.party.toLowerCase()})`, action, entity: "CONTRACT", entityId: contract.id, entityLabel: `${contract.contractNumber} ${contract.title}`, details });

  if (d.action === "comment") {
    if (!["NEGOTIATION", "PENDING_SIGNATURE"].includes(contract.status)) return NextResponse.json({ error: "Comments are closed" }, { status: 422 });
    await prisma.contractComment.create({ data: { contractId: contract.id, authorType, authorName: signatory.name, body: d.body, versionNumber: contract.currentVersion } });
    return NextResponse.json({ ok: true });
  }

  if (d.action === "counter") {
    if (signatory.party !== "SUPPLIER" || contract.status !== "NEGOTIATION") return NextResponse.json({ error: "You can't propose changes right now" }, { status: 403 });
    try {
      const v = await createVersion({ contractId: contract.id, organizationId: contract.organizationId, body: d.body, changeNote: d.note ?? "Counter-proposal from supplier", source: "SUPPLIER", by: { name: signatory.name } });
      if (d.note) await prisma.contractComment.create({ data: { contractId: contract.id, authorType, authorName: signatory.name, body: d.note, versionNumber: v.versionNumber } });
      await audit("UPDATED", { counterProposal: v.versionNumber });
      return NextResponse.json({ ok: true, version: v.versionNumber });
    } catch (e) {
      if (e instanceof VersionError) return NextResponse.json({ error: e.message }, { status: 422 });
      throw e;
    }
  }

  if (d.action === "decline") {
    if (contract.status !== "PENDING_SIGNATURE" || signatory.status !== "PENDING") return NextResponse.json({ error: "There is nothing to decline" }, { status: 422 });
    // A decline sends everything back to negotiation and voids signatures already given,
    // since they were for text that is now going to change.
    await prisma.$transaction([
      prisma.contract.updateMany({ where: { id: contract.id, status: "PENDING_SIGNATURE" }, data: { status: "NEGOTIATION", approvedById: null, approvedAt: null } }),
      prisma.contractSignatory.updateMany({ where: { contractId: contract.id }, data: { status: "PENDING", signedName: null, signedAt: null, signedIp: null, signedUserAgent: null, signedVersion: null, signedDocHash: null, declineReason: null } }),
      prisma.contractSignatory.update({ where: { id: signatory.id }, data: { declineReason: d.reason } }),
      prisma.contractComment.create({ data: { contractId: contract.id, authorType, authorName: signatory.name, body: `Declined to sign: ${d.reason}`, versionNumber: contract.currentVersion } }),
    ]);
    await audit("REJECTED", { declined: true, reason: d.reason });
    return NextResponse.json({ ok: true });
  }

  // sign
  if (contract.status !== "PENDING_SIGNATURE") return NextResponse.json({ error: "This contract isn't open for signing" }, { status: 422 });
  if (signatory.status !== "PENDING") return NextResponse.json({ error: "You've already responded" }, { status: 422 });
  if (vendorReadiness(contract.supplier, { allowPending: contract.type === "NDA" }).ready === false) return NextResponse.json({ error: "This agreement can't be signed yet — supplier onboarding hasn't been completed." }, { status: 422 });
  const version = await prisma.contractVersion.findUnique({ where: { contractId_versionNumber: { contractId: contract.id, versionNumber: contract.currentVersion } }, select: { body: true } });
  if (!version) return NextResponse.json({ error: "Contract text missing" }, { status: 500 });

  // Claim the signature only if it's still pending, so a double-submit can't sign twice.
  const signed = await prisma.contractSignatory.updateMany({
    where: { id: signatory.id, status: "PENDING" },
    data: {
      status: "SIGNED", signedName: d.typedName, signedAt: new Date(), signedVersion: contract.currentVersion,
      signedIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      signedUserAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      signedDocHash: sha256(`${contract.contractNumber}\n${contract.currentVersion}\n${version.body}`),
    },
  });
  if (signed.count === 0) return NextResponse.json({ error: "You've already responded" }, { status: 422 });

  // The last signature publishes the contract.
  const remaining = await prisma.contractSignatory.count({ where: { contractId: contract.id, status: { not: "SIGNED" } } });
  let published = false;
  if (remaining === 0) {
    const r = await prisma.contract.updateMany({
      where: { id: contract.id, status: "PENDING_SIGNATURE" },
      data: { status: "ACTIVE", publishedAt: new Date(), ...(contract.startDate ? {} : { startDate: new Date() }) },
    });
    published = r.count > 0;
  }
  await audit("APPROVED", { signed: true, version: contract.currentVersion, published });
  return NextResponse.json({ ok: true, published });
}
