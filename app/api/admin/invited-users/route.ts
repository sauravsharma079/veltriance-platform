import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [admin, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!admin || !organization || admin.organizationId !== organization.id || admin.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Pending invites = users with invitedAt set but no authId yet (haven't accepted)
  const pending = await prisma.user.findMany({
    where: {
      organizationId: organization.id,
      invitedAt: { not: null },
      authId: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      invitedAt: true,
    },
    orderBy: { invitedAt: "desc" },
  });

  return NextResponse.json({ pending });
}

// DELETE = revoke an invite
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [admin, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!admin || !organization || admin.organizationId !== organization.id || admin.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await req.json();
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.organizationId !== organization.id || target.authId !== null)
    return NextResponse.json({ error: "Not found or already accepted" }, { status: 404 });

  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ success: true });
}
