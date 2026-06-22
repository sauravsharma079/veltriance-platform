import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

const schema = z.object({ role: z.enum(["REQUESTOR", "APPROVER", "PROCUREMENT", "ADMIN"]) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [admin, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);

  if (!admin || !organization || admin.organizationId !== organization.id || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  // Verify the target user actually belongs to this same organization before
  // touching their role — without this check, an admin could guess another
  // tenant's user ID and modify it.
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.organizationId !== organization.id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updated = await prisma.user.update({ where: { id }, data: { role: parsed.data.role } });
  return NextResponse.json({ user: updated });
}
