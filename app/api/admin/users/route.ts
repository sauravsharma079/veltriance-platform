import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { randomBytes } from "crypto";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [profile, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !organization || profile.organizationId !== organization.id) return null;
  if (profile.role !== "ADMIN") return null;
  return { profile, organization };
}

export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, email: true, role: true,
      department: true, phone: true, employeeId: true,
      jobTitle: true, inviteStatus: true, authId: true, invitedAt: true,
      userRoles: {
        include: { role: { select: { id: true, name: true } } },
      },
      contentGroupMembers: {
        include: { contentGroup: { select: { id: true, name: true, color: true } } },
      },
      chartOfAccountAccess: {
        include: { chartOfAccount: { select: { id: true, name: true, code: true } } },
      },
    },
  });
  return NextResponse.json({ users });
}

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  department: z.string().optional(),
  phone: z.string().optional(),
  employeeId: z.string().optional(),
  jobTitle: z.string().optional(),
  workspaceRoleIds: z.array(z.string()).default([]),
  contentGroupIds: z.array(z.string()).default([]),
  chartOfAccountIds: z.array(z.string()).default([]),
  sendInvite: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { workspaceRoleIds, contentGroupIds, chartOfAccountIds, sendInvite, ...userFields } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { email: userFields.email, organizationId: ctx.organization.id },
  });
  if (existing) return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });

  const inviteToken = randomBytes(32).toString("hex");

  // Create user stub
  const user = await prisma.user.create({
    data: {
      ...userFields,
      organizationId: ctx.organization.id,
      role: "REQUESTOR", // default; workspace roles control real permissions
      inviteToken,
      invitedAt: new Date(),
      inviteStatus: "PENDING",
    },
  });

  // Assign workspace roles
  if (workspaceRoleIds.length > 0) {
    await prisma.workspaceRoleMember.createMany({
      data: workspaceRoleIds.map(roleId => ({ userId: user.id, roleId })),
      skipDuplicates: true,
    });
  }

  // Assign content groups
  if (contentGroupIds.length > 0) {
    await prisma.contentGroupMember.createMany({
      data: contentGroupIds.map(contentGroupId => ({ userId: user.id, contentGroupId })),
      skipDuplicates: true,
    });
  }

  // Assign COA access
  if (chartOfAccountIds.length > 0) {
    await prisma.userChartOfAccount.createMany({
      data: chartOfAccountIds.map(chartOfAccountId => ({ userId: user.id, chartOfAccountId })),
      skipDuplicates: true,
    });
  }

  // Send invite email via Supabase admin
  if (sendInvite) {
    try {
      const adminClient = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await adminClient.auth.admin.inviteUserByEmail(userFields.email, {
        data: { name: userFields.name, organizationSlug: ctx.organization.slug, inviteToken },
        redirectTo: `${req.nextUrl.origin}/auth/accept-invite?token=${inviteToken}`,
      });
      await prisma.user.update({ where: { id: user.id }, data: { inviteStatus: "INVITED" } });
    } catch {
      // Invite email failed — user is created, admin can resend from Invite tab
    }
  }

  return NextResponse.json({ user }, { status: 201 });
}
