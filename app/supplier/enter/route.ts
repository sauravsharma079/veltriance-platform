import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionCookie, verifyLoginToken } from "@/lib/supplier-session";

export async function GET(req: NextRequest) {
  const c = verifyLoginToken(req.nextUrl.searchParams.get("t") ?? "");
  const ok = c && await prisma.supplier.count({ where: { id: c.s, status: "ACTIVE" } });
  const res = NextResponse.redirect(new URL(ok ? "/supplier" : "/supplier?expired=1", req.nextUrl.origin));
  if (c && ok) { const k = sessionCookie(c.s, c.m); res.cookies.set(k.name, k.value, k.options); }
  return res;
}
