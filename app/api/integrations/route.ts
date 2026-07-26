import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { INTEGRATION_CATALOG } from "@/lib/integrations-catalog";

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

export async function GET() {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connected = await prisma.integration.findMany({
    where: { organizationId: ctx.organization.id },
    include: { logs: { orderBy: { createdAt: "desc" }, take: 5 } },
  });

  const connectedMap = Object.fromEntries(connected.map(c => [c.key, c]));

  const integrations = INTEGRATION_CATALOG.map(def => ({
    ...def,
    id: connectedMap[def.key]?.id ?? null,
    status: connectedMap[def.key]?.status ?? "DISCONNECTED",
    lastSyncAt: connectedMap[def.key]?.lastSyncAt ?? null,
    connectedAt: connectedMap[def.key]?.createdAt ?? null,
    lastError: connectedMap[def.key]?.lastError ?? null,
    syncCount: connectedMap[def.key]?.syncCount ?? 0,
    errorCount: connectedMap[def.key]?.errorCount ?? 0,
    logs: connectedMap[def.key]?.logs ?? [],
  }));

  return NextResponse.json({ integrations });
}

export async function POST(req: NextRequest) {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { key, config } = body as { key: string; config: Record<string, string> };

  const def = INTEGRATION_CATALOG.find(d => d.key === key);
  if (!def) return NextResponse.json({ error: "Unknown integration" }, { status: 400 });

  const missing = def.fields.filter(f => f.required && !config?.[f.key]?.trim());
  if (missing.length > 0)
    return NextResponse.json({ error: `Missing required fields: ${missing.map(f => f.label).join(", ")}` }, { status: 422 });

  const integration = await prisma.integration.upsert({
    where: { organizationId_key: { organizationId: ctx.organization.id, key } },
    create: {
      key, name: def.name,
      organizationId: ctx.organization.id,
      status: "CONNECTED",
      config: config ?? {},
    },
    update: {
      status: "CONNECTED",
      config: config ?? {},
      lastError: null,
      updatedAt: new Date(),
    },
  });

  // Log the connection event
  await prisma.integrationLog.create({
    data: {
      integrationId: integration.id,
      level: "INFO",
      event: "CONNECTED",
      message: `Successfully connected to ${def.name}`,
    },
  });

  return NextResponse.json({ integration }, { status: 201 });
}
