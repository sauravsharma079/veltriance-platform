import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";
import { extractRequirement } from "@/lib/ai/nlu";
import { decideIntakeRoute, significantWords } from "@/lib/ai/intake-decision";

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

    // The heuristic extractor only matches a category when its literal label appears
    // in the text (e.g. text containing the words "IT Hardware") — a request like
    // "200 laptops" never contains that phrase, so it always fell through to the
    // manual category picker even though "laptop" is unambiguously in the catalog.
    // Cross-check against real catalog item names/descriptions before giving up.
    if (!extracted.category) {
      const keywords = significantWords(extracted.title);
      if (keywords.length > 0) {
        const items = await prisma.catalogItem.findMany({
          where: {
            active: true, category: { not: null },
            catalog: { organizationId: organization.id, status: "ACTIVE", type: "HOSTED" },
          },
          select: { name: true, description: true, category: true },
          take: 200,
        });
        const scored = items
          .map(item => ({
            category: item.category!,
            score: keywords.filter(k => significantWords(`${item.name} ${item.description ?? ""}`).includes(k)).length,
          }))
          .filter(x => x.score > 0)
          .sort((a, b) => b.score - a.score);
        if (scored[0]) extracted.category = scored[0].category;
      }
    }

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
