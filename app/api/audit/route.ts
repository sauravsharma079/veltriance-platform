import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/tenant";
import { getAuditLogs } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ logs: [] });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ logs: [] });
    const entity   = req.nextUrl.searchParams.get("entity") ?? undefined;
    const entityId = req.nextUrl.searchParams.get("entityId") ?? undefined;
    const action   = req.nextUrl.searchParams.get("action") ?? undefined;
    const limit    = parseInt(req.nextUrl.searchParams.get("limit") ?? "200");
    const logs = await getAuditLogs(org.id, { entity, entityId, action, limit });
    return NextResponse.json({ logs });
  } catch (e: any) {
    return NextResponse.json({ logs: [] });
  }
}
