import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

const IMPERSONATION_COOKIE = "vt_impersonate";

/** POST — start impersonating a user */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [admin, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);

  if (!admin || !organization || admin.organizationId !== organization.id || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }

  const { userId } = await req.json();

  // Verify target belongs to the same org and isn't another admin
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.organizationId !== organization.id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (target.id === admin.id) {
    return NextResponse.json({ error: "You can't impersonate yourself" }, { status: 400 });
  }

  const response = NextResponse.json({
    success: true,
    target: { name: target.name, email: target.email, role: target.role },
  });

  // Store: targetUserId|adminUserId so we can validate and restore on exit
  response.cookies.set(IMPERSONATION_COOKIE, `${target.id}|${admin.id}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1 hour max
  });

  return response;
}

/** DELETE — stop impersonating, return to own session */
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(IMPERSONATION_COOKIE);
  return response;
}
