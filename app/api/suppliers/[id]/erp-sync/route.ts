import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { INTEGRATION_CATALOG } from "@/lib/integrations-catalog";
import { syncSupplierAndLog } from "@/lib/erp/sync";

async function getCtx() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const org = await getCurrentOrganization();
  if (!org) return null;
  return { org };
}

const ERP_KEYS = new Set(INTEGRATION_CATALOG.filter(d => d.category === "erp").map(d => d.key));

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const c = await getCtx();
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supplier = await prisma.supplier.findFirst({ where: { id, organizationId: c.org.id } });
  if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  let integration = body.integrationId
    ? await prisma.integration.findFirst({ where: { id: body.integrationId, organizationId: c.org.id } })
    : null;

  if (!integration) {
    const connected = await prisma.integration.findMany({ where: { organizationId: c.org.id, status: "CONNECTED" } });
    integration = connected.find(i => ERP_KEYS.has(i.key)) ?? null;
  }
  if (!integration) return NextResponse.json({ error: "No connected ERP integration found. Connect one from the Integrations page first." }, { status: 422 });

  const result = await syncSupplierAndLog(id, integration.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
