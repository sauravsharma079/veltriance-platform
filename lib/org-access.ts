import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getMemberOrganization } from "@/lib/tenant";
import { moduleGuard } from "@/lib/licensing";
import type { LicenseModuleKey } from "@/lib/license-catalog";

/** Signed in, a member of this workspace, holding one of `roles`, and (optionally) the org holds `module`. */
export async function orgAccess(opts: { roles: string[]; module?: LicenseModuleKey }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const org = await getMemberOrganization(user.id);
  if (!org) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const profile = await prisma.user.findFirst({ where: { authId: user.id, organizationId: org.id }, select: { id: true, name: true, role: true } });
  if (!profile) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!opts.roles.includes(profile.role)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  if (opts.module) { const blocked = moduleGuard(org, opts.module as never); if (blocked) return { error: blocked }; }
  return { org, profile };
}
