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
  if (!profile || !org || profile.organizationId !== org.id) return null;
  return { profile, org };
}

export async function GET() {
  try {
    const ctx = await getCtx();
    if (!ctx) return NextResponse.json({ users: [] });
    const users = await prisma.user.findMany({
      where: { organizationId: ctx.org.id },
      orderBy: { name: 'asc' },
      include: {
        manager: { select: { id: true, name: true } },
        userRoles: { include: { role: { select: { id: true, name: true } } } },
        contentGroupMembers: { include: { contentGroup: { select: { id: true, name: true } } } },
        chartOfAccountAccess: { include: { chartOfAccount: { select: { id: true, code: true } } } },
      },
    });
    return NextResponse.json({ users });
  } catch { return NextResponse.json({ users: [] }); }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    const user = await prisma.user.create({
      data: {
        organizationId: admin.organizationId,
        email: body.email, name: body.name,
        role: body.role || 'REQUESTOR',
        jobTitle: body.jobTitle || null,
        department: body.department || null,
        employeeId: body.employeeId || null,
        managerId: body.managerId || null,
        businessUnit: body.businessUnit || null,
        costCenter: body.costCenter || null,
        addressLine1: body.addressLine1 || null,
        addressLine2: body.addressLine2 || null,
        city: body.city || null,
        state: body.state || null,
        postalCode: body.postalCode || null,
        country: body.country || null,
        currency: body.currency || 'INR', inviteStatus: 'PENDING',
      },
    });

    // AdminAgent's bot flow has always sent these three arrays here (resolved from
    // typed names to IDs client-side) expecting them to be applied at creation —
    // this route never read them, so bot-created users never actually got their
    // roles/groups/COA access despite the bot reporting success.
    const workspaceRoleIds: string[] = Array.isArray(body.workspaceRoleIds) ? body.workspaceRoleIds : [];
    const contentGroupIds: string[] = Array.isArray(body.contentGroupIds) ? body.contentGroupIds : [];
    const chartOfAccountIds: string[] = Array.isArray(body.chartOfAccountIds) ? body.chartOfAccountIds : [];
    await Promise.all([
      ...workspaceRoleIds.map(roleId => prisma.workspaceRoleMember.upsert({
        where: { userId_roleId: { userId: user.id, roleId } }, create: { userId: user.id, roleId }, update: {},
      })),
      ...contentGroupIds.map(contentGroupId => prisma.contentGroupMember.upsert({
        where: { contentGroupId_userId: { contentGroupId, userId: user.id } }, create: { contentGroupId, userId: user.id }, update: {},
      })),
      ...chartOfAccountIds.map(chartOfAccountId => prisma.userChartOfAccount.upsert({
        where: { userId_chartOfAccountId: { userId: user.id, chartOfAccountId } }, create: { userId: user.id, chartOfAccountId }, update: {},
      })),
    ]);

    return NextResponse.json({ user }, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "A user with this employee ID already exists" }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
