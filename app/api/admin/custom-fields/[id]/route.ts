import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [profile, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !organization || profile.organizationId !== organization.id || profile.role !== "ADMIN") return null;
  return { profile, organization };
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  helpText: z.string().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

function zodErrorMessage(err: z.ZodError): string {
  const flat = err.flatten();
  const fieldParts = Object.entries(flat.fieldErrors).map(([k, v]) => `${k}: ${(v as string[] | undefined)?.[0]}`);
  return [...flat.formErrors, ...fieldParts].join(", ") || "Validation failed";
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.customField.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== ctx.organization.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 422 });

  const field = await prisma.customField.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ field });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.customField.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== ctx.organization.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.customField.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
