import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

const contactSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  department: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile, organization] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    getCurrentOrganization(),
  ]);
  if (!profile || !organization || profile.organizationId !== organization.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "PROCUREMENT" && profile.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== organization.id)
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const body = await req.json();
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  if (parsed.data.isPrimary) {
    await prisma.supplierContact.updateMany({ where: { supplierId: id }, data: { isPrimary: false } });
  }

  const contact = await prisma.supplierContact.create({ data: { ...parsed.data, supplierId: id } });
  return NextResponse.json({ contact }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: supplierId } = await params;
  const { contactId } = await req.json();
  const organization = await getCurrentOrganization();
  if (!organization) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!existing || existing.organizationId !== organization.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.supplierContact.delete({ where: { id: contactId, supplierId } });
  return NextResponse.json({ success: true });
}
