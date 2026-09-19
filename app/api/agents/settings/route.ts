import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { agentAccess } from "@/lib/agents/access";

const schema = z.object({ autonomy: z.enum(["SUGGEST", "ACT_NOTIFY", "AUTO"]) });

/** How much agents may do without asking. ADMIN only — it's the org's risk appetite. */
export async function PUT(req: NextRequest) {
  const a = await agentAccess({ adminOnly: true });
  if ("error" in a) return a.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid autonomy level" }, { status: 422 });
  await prisma.organization.update({ where: { id: a.org.id }, data: { agentAutonomy: parsed.data.autonomy } });
  await logAudit({
    organizationId: a.org.id, userId: a.profile.id, userName: a.profile.name,
    action: "UPDATED", entity: "AGENT", entityId: a.org.id, entityLabel: "Agent autonomy",
    details: { from: a.org.agentAutonomy, to: parsed.data.autonomy },
  });
  return NextResponse.json({ autonomy: parsed.data.autonomy });
}
