import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { seatGuard } from "@/lib/licensing";
import { getCurrentOrganization } from "@/lib/tenant";
import { errorMessage } from "@/lib/errors";
import { sendUserInvite } from "@/lib/user-invite";

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["REQUESTOR", "APPROVER", "PROCUREMENT", "ADMIN"]).default("REQUESTOR"),
  department: z.string().optional(),
});

/** Creates a user stub and invites them in one step (ADMIN only). */
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

  const seatBlocked = await seatGuard(organization.id);
  if (seatBlocked) return seatBlocked;

  const parsed = inviteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const { email, name, role, department } = parsed.data;

  const existing = await prisma.user.findFirst({ where: { organizationId: organization.id, email } });
  if (existing) return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });

  const invited = await prisma.user.create({ data: { organizationId: organization.id, email, name, role, department, invitedAt: new Date(), inviteStatus: "PENDING" } });
  try {
    const invite = await sendUserInvite({ user: invited, organization, origin: req.nextUrl.origin, invitedBy: admin.name });
    return NextResponse.json({ user: { id: invited.id, email, name, role }, invite, message: invite.emailed ? `Invite emailed to ${email}` : `User created, but the email could not be sent` }, { status: 201 });
  } catch (e) {
    // The user is kept: the admin can retry with "Resend invite" once the cause is fixed.
    return NextResponse.json({ user: { id: invited.id, email, name, role }, inviteError: errorMessage(e) }, { status: 201 });
  }
}
