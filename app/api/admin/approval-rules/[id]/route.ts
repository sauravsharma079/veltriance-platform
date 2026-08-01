import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [profile, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !organization || profile.organizationId !== organization.id || profile.role !== "ADMIN") return null;
  return { profile, organization };
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  module: z.string().optional(),
  priority: z.number().int().optional(),
  active: z.boolean().optional(),
  minAmount: z.number().nonnegative().nullable().optional(),
  maxAmount: z.number().nonnegative().nullable().optional(),
  category: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  steps: z.array(z.object({
    sequence: z.number().int().positive(),
    stepType: z.enum(["MANAGER", "DIRECTOR", "PROCUREMENT", "FINANCE", "CUSTOM"]),
    stepLabel: z.string().nullable().optional(),
    assignedUserId: z.string().nullable().optional(),
    approverUserIds: z.array(z.string()).optional(),
    approverMode: z.enum(["ANY", "ALL"]).optional(),
  })).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.approvalRule.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== ctx.organization.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { steps, ...ruleData } = parsed.data;

  const rule = await prisma.$transaction(async (tx) => {
    if (steps) {
      await tx.approvalRuleStep.deleteMany({ where: { ruleId: id } });
      await tx.approvalRuleStep.createMany({ data: steps.map(s => ({ ...s, ruleId: id })) });
    }
    return tx.approvalRule.update({ where: { id }, data: ruleData, include: { steps: true } });
  });

  return NextResponse.json({ rule });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.approvalRule.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== ctx.organization.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.approvalRule.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
