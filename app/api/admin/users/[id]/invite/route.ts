import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { errorMessage } from "@/lib/errors";
import { sendUserInvite } from "@/lib/user-invite";

/** Sends a fresh invitation to someone who hasn't accepted yet. Any earlier link stops working. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const user = await prisma.user.findFirst({ where: { id, organizationId: admin.organizationId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.authId && !user.authId.startsWith("pending_")) return NextResponse.json({ error: "They've already accepted their invitation" }, { status: 422 });
  try {
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: admin.organizationId }, select: { slug: true, name: true } });
    const invite = await sendUserInvite({ user, organization: org, origin: req.nextUrl.origin, invitedBy: admin.profile.name });
    await logAudit({ organizationId: admin.organizationId, userId: admin.profile.id, userName: admin.profile.name, action: "SENT", entity: "USER", entityId: user.id, entityLabel: user.name, details: { invite: "resent", emailed: invite.emailed } });
    return NextResponse.json({ invite });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
