import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [profile, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !organization || profile.organizationId !== organization.id) return null;
  return { profile, organization };
}

type P = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: P) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const integration = await prisma.integration.findFirst({
    where: { id, organizationId: ctx.organization.id },
    include: { logs: { orderBy: { createdAt: "desc" }, take: 50 } },
  });
  if (!integration) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ integration });
}

export async function PATCH(req: NextRequest, { params }: P) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const integration = await prisma.integration.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!integration) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.integration.update({
    where: { id },
    data: {
      ...(body.status    !== undefined && { status: body.status }),
      ...(body.config    !== undefined && { config: body.config }),
      ...(body.lastError !== undefined && { lastError: body.lastError }),
      ...(body.status === "CONNECTED"  && { lastSyncAt: new Date() }),
      updatedAt: new Date(),
    },
  });

  if (body.logEvent) {
    await prisma.integrationLog.create({
      data: {
        integrationId: id,
        level: body.logEvent.level ?? "INFO",
        event: body.logEvent.event,
        message: body.logEvent.message,
        meta: body.logEvent.meta ?? {},
      },
    });
  }

  return NextResponse.json({ integration: updated });
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const integration = await prisma.integration.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!integration) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.integration.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
