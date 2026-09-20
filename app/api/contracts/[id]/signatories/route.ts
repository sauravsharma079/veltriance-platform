import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { contractAccess } from "@/lib/contracts-access";
import { newSigningToken } from "@/lib/contracts";

// Signatories are fixed once the contract is approved for signing.
const OPEN = ["DRAFT", "NEGOTIATION", "PENDING_APPROVAL"];
const schema = z.object({ party: z.enum(["BUYER", "SUPPLIER"]), name: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().email(), title: z.string().trim().max(120).optional() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await contractAccess();
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 });
  const contract = await prisma.contract.findFirst({ where: { id, organizationId: a.org.id }, select: { status: true } });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!OPEN.includes(contract.status)) return NextResponse.json({ error: "Signatories can't be changed at this stage" }, { status: 422 });
  const dupe = await prisma.contractSignatory.findFirst({ where: { contractId: id, email: parsed.data.email } });
  if (dupe) return NextResponse.json({ error: "That person is already on this contract" }, { status: 409 });
  // The link is issued when they're invited (share / approve), not here.
  const signatory = await prisma.contractSignatory.create({
    data: { contractId: id, ...parsed.data, tokenHash: newSigningToken().tokenHash },
    select: { id: true, party: true, name: true, email: true, title: true, status: true },
  });
  return NextResponse.json({ signatory }, { status: 201 });
}
