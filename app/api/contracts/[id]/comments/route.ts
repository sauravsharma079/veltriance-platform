import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { contractAccess } from "@/lib/contracts-access";

const schema = z.object({ body: z.string().trim().min(1).max(5000), internal: z.boolean().default(false) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await contractAccess();
  if ("error" in a) return a.error;
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a comment first" }, { status: 422 });
  const contract = await prisma.contract.findFirst({ where: { id, organizationId: a.org.id }, select: { id: true, currentVersion: true } });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const comment = await prisma.contractComment.create({
    data: { contractId: id, authorType: "BUYER", authorName: a.profile.name, body: parsed.data.body, internal: parsed.data.internal, versionNumber: contract.currentVersion },
  });
  return NextResponse.json({ comment }, { status: 201 });
}
