import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getMemberOrganization } from "@/lib/tenant";
import { moduleGuard } from "@/lib/licensing";

/**
 * Auth for the agent endpoints: signed in, a member of this workspace,
 * PROCUREMENT or ADMIN (or ADMIN only, for settings), and the org must hold
 * the AGENTS licence module.
 */
export async function agentAccess(opts: { adminOnly?: boolean } = {}) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const org = await getMemberOrganization(user.id);
  if (!org) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const profile = await prisma.user.findFirst({ where: { authId: user.id, organizationId: org.id }, select: { id: true, name: true, role: true } });
  if (!profile) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const allowed = opts.adminOnly ? profile.role === "ADMIN" : profile.role === "ADMIN" || profile.role === "PROCUREMENT";
  if (!allowed) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const blocked = moduleGuard(org, "AGENTS");
  if (blocked) return { error: blocked };
  return { org, profile };
}
