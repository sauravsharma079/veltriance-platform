import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getMemberOrganization } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";

async function me() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const org = await getMemberOrganization(user.id);
  if (!org) return null;
  const profile = await prisma.user.findFirst({ where: { authId: user.id, organizationId: org.id }, select: { id: true, name: true, delegateId: true, outOfOfficeUntil: true } });
  return profile ? { org, profile } : null;
}

/** My out-of-office setting, and who could cover for me. */
export async function GET() {
  const c = await me();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const candidates = await prisma.user.findMany({ where: { organizationId: c.org.id, id: { not: c.profile.id }, role: { in: ["APPROVER", "PROCUREMENT", "ADMIN"] }, AND: [{ authId: { not: null } }, { NOT: { authId: { startsWith: "pending_" } } }] }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } });
  const active = !!c.profile.outOfOfficeUntil && c.profile.outOfOfficeUntil > new Date();
  return NextResponse.json({ delegateId: active ? c.profile.delegateId : null, until: active ? c.profile.outOfOfficeUntil : null, candidates });
}

const schema = z.object({ delegateId: z.string().min(1).nullable(), until: z.string().date().nullable() });

/** Set or clear out-of-office. While it's on, approvals addressed to me also go to (and can be decided by) my delegate. */
export async function PUT(req: NextRequest) {
  const c = await me();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 422 });
  const { delegateId, until } = parsed.data;
  if (!delegateId || !until) {
    await prisma.user.update({ where: { id: c.profile.id }, data: { delegateId: null, outOfOfficeUntil: null } });
    await logAudit({ organizationId: c.org.id, userId: c.profile.id, userName: c.profile.name, action: "UPDATED", entity: "USER", entityId: c.profile.id, entityLabel: c.profile.name, details: { outOfOffice: "cleared" } });
    return NextResponse.json({ ok: true });
  }
  const end = new Date(`${until}T23:59:59`);
  if (end <= new Date()) return NextResponse.json({ error: "The end date must be in the future" }, { status: 422 });
  if (end.getTime() > Date.now() + 90 * 86_400_000) return NextResponse.json({ error: "Out of office can be set for at most 90 days at a time" }, { status: 422 });
  if (delegateId === c.profile.id) return NextResponse.json({ error: "You can't delegate to yourself" }, { status: 422 });
  const delegate = await prisma.user.findFirst({ where: { id: delegateId, organizationId: c.org.id, role: { in: ["APPROVER", "PROCUREMENT", "ADMIN"] }, AND: [{ authId: { not: null } }, { NOT: { authId: { startsWith: "pending_" } } }] }, select: { name: true } });
  if (!delegate) return NextResponse.json({ error: "Choose a colleague who can approve and has signed in" }, { status: 422 });
  await prisma.user.update({ where: { id: c.profile.id }, data: { delegateId, outOfOfficeUntil: end } });
  await logAudit({ organizationId: c.org.id, userId: c.profile.id, userName: c.profile.name, action: "UPDATED", entity: "USER", entityId: c.profile.id, entityLabel: c.profile.name, details: { outOfOffice: "set", delegate: delegate.name, until } });
  return NextResponse.json({ ok: true });
}
