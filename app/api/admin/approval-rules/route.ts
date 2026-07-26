import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

async function requireAdmin(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [profile, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !organization || profile.organizationId !== organization.id || profile.role !== "ADMIN")
    return null;
  return { profile, organization };
}

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rules = await prisma.approvalRule.findMany({
    where: { organizationId: ctx.organization.id },
    include: { steps: { orderBy: { sequence: "asc" } } },
    orderBy: { priority: "asc" },
  });
  return NextResponse.json({ rules });
}

const ruleSchema = z.object({
  name: z.string().min(1),
  priority: z.number().int().default(100),
  active: z.boolean().default(true),
  minAmount: z.number().nonnegative().nullable().optional(),
  maxAmount: z.number().nonnegative().nullable().optional(),
  category: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  steps: z.array(z.object({
    sequence: z.number().int().positive(),
    stepType: z.enum(["MANAGER", "DIRECTOR", "PROCUREMENT", "FINANCE", "CUSTOM"]),
    stepLabel: z.string().nullable().optional(),
    assignedUserId: z.string().nullable().optional(),
  })).min(1),
});

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = ruleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { steps, ...ruleData } = parsed.data;
  const rule = await prisma.approvalRule.create({
    data: {
      ...ruleData,
      organizationId: ctx.organization.id,
      steps: { create: steps },
    },
    include: { steps: true },
  });
  return NextResponse.json({ rule }, { status: 201 });
}
