import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { contractAccess } from "@/lib/contracts-access";
import { CONTRACT_TYPES, nextContractNumber } from "@/lib/contracts";

export async function GET(req: NextRequest) {
  const a = await contractAccess();
  if ("error" in a) return a.error;
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const status = req.nextUrl.searchParams.get("status");
  const contracts = await prisma.contract.findMany({
    where: {
      organizationId: a.org.id,
      ...(status && { status: status as never }),
      ...(q && { OR: [{ title: { contains: q, mode: "insensitive" } }, { contractNumber: { contains: q, mode: "insensitive" } }, { supplier: { name: { contains: q, mode: "insensitive" } } }] }),
    },
    orderBy: { updatedAt: "desc" }, take: 200,
    select: {
      id: true, contractNumber: true, title: true, type: true, status: true, value: true, currency: true,
      startDate: true, endDate: true, autoRenew: true, noticeDays: true, updatedAt: true,
      supplier: { select: { id: true, name: true } }, owner: { select: { name: true } },
    },
  });
  return NextResponse.json({ contracts });
}

const createSchema = z.object({
  title: z.string().trim().min(3).max(200),
  type: z.enum(CONTRACT_TYPES),
  supplierId: z.string().min(1).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  value: z.number().nonnegative().nullable().optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  startDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(),
  autoRenew: z.boolean().optional(),
  noticeDays: z.number().int().min(0).max(365).optional(),
  body: z.string().max(200_000).optional(),
}).refine(d => !d.startDate || !d.endDate || d.endDate >= d.startDate, { message: "End date can't be before the start date", path: ["endDate"] });

export async function POST(req: NextRequest) {
  const a = await contractAccess();
  if ("error" in a) return a.error;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 });
  const d = parsed.data;

  if (d.supplierId) {
    const sup = await prisma.supplier.findFirst({ where: { id: d.supplierId, organizationId: a.org.id }, select: { id: true } });
    if (!sup) return NextResponse.json({ error: "Supplier not found" }, { status: 422 });
  }

  // The number is derived from a count, so two simultaneous creates can collide — retry.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const contract = await prisma.contract.create({
        data: {
          organizationId: a.org.id, contractNumber: await nextContractNumber(a.org.id),
          title: d.title, type: d.type, supplierId: d.supplierId ?? null, ownerId: a.profile.id,
          description: d.description ?? null, value: d.value ?? null, currency: d.currency ?? "INR",
          startDate: d.startDate ? new Date(d.startDate) : null, endDate: d.endDate ? new Date(d.endDate) : null,
          autoRenew: d.autoRenew ?? false, noticeDays: d.noticeDays ?? 60,
          versions: { create: { versionNumber: 1, body: d.body ?? "", source: "HUMAN", createdById: a.profile.id, createdByName: a.profile.name, changeNote: "Initial version" } },
        },
      });
      await logAudit({
        organizationId: a.org.id, userId: a.profile.id, userName: a.profile.name,
        action: "CREATED", entity: "CONTRACT", entityId: contract.id, entityLabel: `${contract.contractNumber} ${contract.title}`,
      });
      return NextResponse.json({ contract }, { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 2) continue;
      throw e;
    }
  }
}
