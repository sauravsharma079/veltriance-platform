import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

// Public (auth-required) endpoint for users to fetch COAs when filling forms
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const organization = await getCurrentOrganization();
  if (!organization) return NextResponse.json({ coas: [], lookupTypes: [] });

  const [coas, lookupTypes] = await Promise.all([
    prisma.chartOfAccount.findMany({
      where: { organizationId: organization.id, isActive: true },
      orderBy: { name: "asc" },
      include: {
        segments: {
          orderBy: { position: "asc" },
          include: { values: { where: { isActive: true }, orderBy: { code: "asc" } } },
        },
      },
    }),
    // Return all lookup values grouped by type — the GL panel uses these for linked segments
    prisma.lookup.findMany({
      where: { organizationId: organization.id, active: true },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
      select: { type: true, code: true, label: true },
    }),
  ]);

  return NextResponse.json({ coas, lookupValues: lookupTypes });
}
