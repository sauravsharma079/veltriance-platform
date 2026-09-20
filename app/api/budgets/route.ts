import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { orgAccess } from "@/lib/org-access";
import { budgetsWithUsage } from "@/lib/budget";
import { budgetFields } from "@/lib/budget-schema";

export async function GET() {
  const a = await orgAccess({ roles: ["ADMIN", "PROCUREMENT"], module: "INTAKE_TO_PO" });
  if ("error" in a) return a.error;
  return NextResponse.json({ budgets: await budgetsWithUsage(a.org.id), canEdit: a.profile.role === "ADMIN" });
}

const createSchema = z.object({ ...budgetFields, currency: budgetFields.currency.default("INR"), warnPct: budgetFields.warnPct.default(80), hardStop: budgetFields.hardStop.default(false), active: budgetFields.active.default(true) })
  .refine(d => d.endDate >= d.startDate, { message: "The end date can't be before the start date", path: ["endDate"] });

export async function POST(req: NextRequest) {
  const a = await orgAccess({ roles: ["ADMIN"], module: "INTAKE_TO_PO" });
  if ("error" in a) return a.error;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422 });
  const d = parsed.data;
  const budget = await prisma.budget.create({ data: { organizationId: a.org.id, ...d, startDate: new Date(d.startDate), endDate: new Date(`${d.endDate}T23:59:59`), department: d.department || null, costCenter: d.costCenter || null, category: d.category || null } });
  await logAudit({ organizationId: a.org.id, userId: a.profile.id, userName: a.profile.name, action: "CREATED", entity: "COA", entityId: budget.id, entityLabel: `Budget: ${budget.name}`, details: { amount: d.amount, hardStop: d.hardStop } });
  return NextResponse.json({ budget }, { status: 201 });
}
