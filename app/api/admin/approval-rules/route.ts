import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { requireAdmin } from "@/lib/api-auth";

async function getCtx() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const [profile, org] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !org) return null;
  return { profile, org };
}

export async function GET() {
  try {
    const ctx = await getCtx();
    if (!ctx) return NextResponse.json({ rules: [] });
    const rules = await prisma.approvalRule.findMany({
      where: { organizationId: ctx.org.id },
      include: { steps: { orderBy: { sequence: 'asc' } } },
      orderBy: { priority: 'asc' },
    });
    return NextResponse.json({ rules });
  } catch { return NextResponse.json({ rules: [] }); }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    const rule = await prisma.approvalRule.create({
      data: {
        organizationId: admin.organizationId,
        name: body.name, priority: body.priority || 10,
        active: body.active ?? true,
        module: body.module || "REQUISITION",
        category: body.category || null,
        department: body.department || null,
        minAmount: body.minAmount || null,
        maxAmount: body.maxAmount || null,
      },
    });
    if (body.steps?.length) {
      await prisma.approvalRuleStep.createMany({
        data: body.steps.map((s: any) => ({
          ruleId: rule.id, sequence: s.sequence,
          stepType: s.stepType, stepLabel: s.stepLabel,
          assignedUserId: s.assignedUserId || null,
          approverUserIds: Array.isArray(s.approverUserIds) ? s.approverUserIds : [],
          approverMode: s.approverMode === "ALL" ? "ALL" : "ANY",
        })),
      });
    }
    const full = await prisma.approvalRule.findUnique({ where: { id: rule.id }, include: { steps: true } });
    return NextResponse.json({ rule: full }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await req.json();
    const existing = await prisma.approvalRule.findFirst({ where: { id, organizationId: admin.organizationId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await prisma.approvalRuleStep.deleteMany({ where: { ruleId: id } });
    await prisma.approvalRule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
