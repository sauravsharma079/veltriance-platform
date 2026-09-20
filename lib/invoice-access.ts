import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getMemberOrganization } from "@/lib/tenant";
import { moduleGuard } from "@/lib/licensing";

/** Signed in, member of this workspace, PROCUREMENT or ADMIN, and the org holds the INVOICING module. */
export async function invoiceAccess() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const org = await getMemberOrganization(user.id);
  if (!org) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const profile = await prisma.user.findFirst({ where: { authId: user.id, organizationId: org.id }, select: { id: true, name: true, role: true } });
  if (!profile) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (profile.role !== "ADMIN" && profile.role !== "PROCUREMENT") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const blocked = moduleGuard(org, "INVOICING");
  if (blocked) return { error: blocked };
  return { org, profile };
}
