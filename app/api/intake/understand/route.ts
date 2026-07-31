import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { extractRequirement } from "@/lib/ai/nlu";
import { decideIntakeRoute } from "@/lib/ai/intake-decision";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [profile, organization] = await Promise.all([
      prisma.user.findUnique({ where: { authId: user.id } }),
      getCurrentOrganization(),
    ]);
    if (!profile || !organization || profile.organizationId !== organization.id)
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const { text } = await req.json() as { text?: string };
    if (!text?.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 });

    const categoryLookups = await prisma.lookup.findMany({
      where: { organizationId: organization.id, type: "CATEGORY" },
      select: { label: true },
    });
    const categories = categoryLookups.map(l => l.label);

    const extracted = await extractRequirement(text, categories);
    // Only run the catalog/supplier decision engine when we actually have a category —
    // otherwise "no match" would just mean "we never searched", not "no supplier exists".
    const decision = extracted.category
      ? await decideIntakeRoute({ organizationId: organization.id, department: profile.department, extracted })
      : null;

    return NextResponse.json({ extracted, decision, categories });
  } catch (e: any) {
    console.error("[intake/understand]", e?.message);
    return NextResponse.json({ error: e?.message ?? "Failed to understand request" }, { status: 500 });
  }
}
