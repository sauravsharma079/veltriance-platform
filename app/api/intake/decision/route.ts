import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { decideIntakeRoute } from "@/lib/ai/intake-decision";
import type { ExtractedRequirement } from "@/lib/ai/nlu";

// Re-runs the catalog/supplier decision engine once a category is known — used when
// the initial free-text extraction couldn't confidently detect one and the user
// picked it manually from /api/intake/understand's `categories` list.
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

    const body = await req.json() as { category?: string; quantity?: number | null; title?: string };
    if (!body.category) return NextResponse.json({ error: "category is required" }, { status: 400 });

    const extracted: ExtractedRequirement = {
      title: body.title ?? "", category: body.category, quantity: body.quantity ?? null,
      deliveryLocation: null, requiredDate: null, priority: "MEDIUM",
      businessJustification: null, confidence: "heuristic",
    };
    const decision = await decideIntakeRoute({ organizationId: organization.id, department: profile.department, extracted });
    return NextResponse.json({ decision });
  } catch (e: any) {
    console.error("[intake/decision]", e?.message);
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
