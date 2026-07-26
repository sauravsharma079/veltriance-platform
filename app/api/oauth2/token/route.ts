import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash, randomBytes } from "crypto";

const TTL = 3600;
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

async function body(req: NextRequest) {
  const ct = req.headers.get("content-type") ?? "";
  return ct.includes("json") ? req.json() : Object.fromEntries(new URLSearchParams(await req.text()));
}

export async function POST(req: NextRequest) {
  const b = await body(req);
  if (b.grant_type !== "client_credentials")
    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
  if (!b.client_id || !b.client_secret)
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const c = await prisma.apiClient.findUnique({ where: { clientId: b.client_id } });
  if (!c?.active || c.clientSecretHash !== hash(b.client_secret))
    return NextResponse.json({ error: "invalid_client" }, { status: 401 });
  const requested = b.scope ? b.scope.split(/\s+/).filter(Boolean) : c.scopes;
  const granted   = requested.filter((s: string) => c.scopes.includes(s));
  if (!granted.length) return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
  const raw = "vlt_" + randomBytes(32).toString("hex");
  await prisma.apiToken.create({ data: { apiClientId: c.id, tokenHash: hash(raw), scopes: granted, expiresAt: new Date(Date.now() + TTL * 1000) } });
  await prisma.apiClient.update({ where: { id: c.id }, data: { lastUsedAt: new Date() } });
  return NextResponse.json({ access_token: raw, token_type: "Bearer", expires_in: TTL, scope: granted.join(" ") });
}
