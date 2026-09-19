import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMemberOrganization } from "@/lib/tenant";
import { activeModules, isLicenseExpired, seatUsage } from "@/lib/licensing";
import { planLabel } from "@/lib/license-catalog";

/** The signed-in user's view of their org's license (read-only). */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMemberOrganization(user.id);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const seats = await seatUsage(org.id);
  return NextResponse.json({
    plan: org.plan, planLabel: planLabel(org.plan),
    modules: activeModules(org), expired: isLicenseExpired(org),
    expiresAt: org.licenseExpiresAt, seatLimit: org.seatLimit, seatsUsed: seats.used,
  });
}
