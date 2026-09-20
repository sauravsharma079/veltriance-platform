import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { moduleGuard } from "@/lib/licensing";
import { getCurrentOrganization } from "@/lib/tenant";
import { decideStep } from "@/lib/requisition-approval";

const actionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  comment: z.string().optional(),
});

/** The rules live in lib/requisition-approval.ts so the app, the email link and agents share them. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !organization || profile.organizationId !== organization.id) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  { const blocked = moduleGuard(organization, "INTAKE_TO_PO"); if (blocked) return blocked; }

  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const r = await decideStep({
    organizationId: organization.id, requisitionId: id, actor: { id: profile.id, name: profile.name, role: profile.role },
    decision: parsed.data.decision, comment: parsed.data.comment, via: "app", origin: req.nextUrl.origin,
  });
  return NextResponse.json(r.json, { status: r.status });
}
