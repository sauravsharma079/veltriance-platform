import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { publicBaseUrl } from "@/lib/contracts";
import { signLink, verifyLink } from "@/lib/signed-links";

// Supplier portal sign-in is passwordless: a link emailed to a contact address on file proves control of the
// mailbox and starts a session cookie. Everything a signed-in supplier sees is scoped to ONE supplier record,
// which belongs to exactly one buyer organisation, so one buyer's data can never reach another's suppliers.
export const SESSION_COOKIE = "vt_supplier";
const SESSION_DAYS = 7;

export function sessionCookie(supplierId: string, email: string) {
  return { name: SESSION_COOKIE, value: signLink("supplier-session", { s: supplierId, m: email }, SESSION_DAYS), options: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: SESSION_DAYS * 86_400 } };
}

export type SupplierSession = { supplier: { id: string; name: string; organizationId: string }; organization: { id: string; name: string }; email: string };

/** The signed-in supplier, or null. Re-checks the supplier is still active, so blocking a vendor cuts access at once. */
export async function getSupplierSession(): Promise<SupplierSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const c = verifyLink<{ s: string; m: string }>(token, "supplier-session");
  if (!c) return null;
  const supplier = await prisma.supplier.findFirst({ where: { id: c.s, status: "ACTIVE" }, select: { id: true, name: true, organizationId: true, organization: { select: { id: true, name: true } } } });
  if (!supplier) return null;
  return { supplier: { id: supplier.id, name: supplier.name, organizationId: supplier.organizationId }, organization: supplier.organization, email: c.m };
}

export async function requireSupplier(): Promise<{ s: SupplierSession } | { error: NextResponse }> {
  const s = await getSupplierSession();
  return s ? { s } : { error: NextResponse.json({ error: "Please sign in again" }, { status: 401 }) };
}

/** Emails a sign-in link for every active supplier record this address is a contact on. Silent when there's none. */
export async function sendLoginLinks(rawEmail: string, origin?: string): Promise<number> {
  const email = rawEmail.trim().toLowerCase();
  const matches = await prisma.supplier.findMany({
    where: { status: "ACTIVE", OR: [{ contactEmail: { equals: email, mode: "insensitive" } }, { contacts: { some: { email: { equals: email, mode: "insensitive" } } } }] },
    select: { id: true, name: true, organization: { select: { name: true } } }, take: 5,
  });
  if (matches.length === 0) return 0;
  const base = publicBaseUrl(origin);
  const lines = matches.map(m => `  • ${m.name} — ${m.organization.name}\n    ${base}/supplier/enter?t=${encodeURIComponent(signLink("supplier-login", { s: m.id, m: email }, 1))}`).join("\n");
  await sendEmail({ to: email, subject: "Your supplier portal sign-in link", text: `Hello,\n\nUse the link below to sign in to the supplier portal and see your purchase orders and invoices:\n\n${lines}\n\nThe link works for 24 hours. If you didn't ask for it, you can ignore this email — nobody can sign in without it.` });
  return matches.length;
}

export function verifyLoginToken(token: string) {
  return verifyLink<{ s: string; m: string }>(token, "supplier-login");
}
