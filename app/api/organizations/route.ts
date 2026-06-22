import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { isValidSlug, isReservedSlug } from "@/lib/tenant";

const createOrgSchema = z.object({
  organizationName: z.string().min(2),
  slug: z.string().min(3).max(32),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createOrgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { organizationName, slug: rawSlug, name, email, password } = parsed.data;
  const slug = rawSlug.toLowerCase().trim();

  if (!isValidSlug(slug)) {
    return NextResponse.json(
      { error: "Workspace URL must be 3–32 characters, lowercase letters, numbers, and hyphens only." },
      { status: 422 }
    );
  }
  if (isReservedSlug(slug)) {
    return NextResponse.json({ error: "That workspace URL is reserved — please choose another." }, { status: 422 });
  }

  const existing = await prisma.organization.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "That workspace URL is already taken." }, { status: 409 });
  }

  const origin = req.nextUrl.origin;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, pendingOrgName: organizationName, pendingOrgSlug: slug },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data.user) {
    return NextResponse.json({ error: "Something went wrong creating your account." }, { status: 500 });
  }

  // If email confirmation is OFF in Supabase, we get an active session immediately
  // and can finish provisioning right now. If it's ON, /auth/callback finishes this
  // once they click the confirmation link — see that route for the matching logic.
  if (data.session) {
    const organization = await prisma.organization.create({
      data: { name: organizationName, slug },
    });
    await prisma.user.create({
      data: {
        organizationId: organization.id,
        authId: data.user.id,
        email,
        name,
        role: "ADMIN",
      },
    });
    return NextResponse.json({ slug, immediate: true }, { status: 201 });
  }

  return NextResponse.json({ pendingConfirmation: true }, { status: 202 });
}
