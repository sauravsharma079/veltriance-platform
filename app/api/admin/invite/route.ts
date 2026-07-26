import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { randomBytes } from "crypto";

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["REQUESTOR", "APPROVER", "PROCUREMENT", "ADMIN"]).default("REQUESTOR"),
  department: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [admin, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!admin || !organization || admin.organizationId !== organization.id || admin.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { email, name, role, department } = parsed.data;

  // Check if a user with this email already exists in the org
  const existing = await prisma.user.findFirst({
    where: { organizationId: organization.id, email },
  });
  if (existing) return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });

  // Generate a secure invite token
  const inviteToken = randomBytes(32).toString("hex");

  // Create the user stub — authId is null until they accept the invite
  const invited = await prisma.user.create({
    data: {
      organizationId: organization.id,
      email,
      name,
      role,
      department,
      invitedAt: new Date(),
      inviteToken,
    },
  });

  // Use service role key for admin auth operations — the regular anon client
  // doesn't have permission to send invites via supabase.auth.admin
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      name,
      organizationSlug: organization.slug,
      organizationName: organization.name,
      inviteToken,
    },
    redirectTo: `${req.nextUrl.origin}/auth/accept-invite?token=${inviteToken}`,
  });

  if (inviteError) {
    // Roll back the user stub if the email failed
    await prisma.user.delete({ where: { id: invited.id } });
    return NextResponse.json({ error: `Failed to send invite email: ${inviteError.message}` }, { status: 500 });
  }

  return NextResponse.json({
    user: { id: invited.id, email, name, role },
    message: `Invite sent to ${email}`,
  }, { status: 201 });
}
