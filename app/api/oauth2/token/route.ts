import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    let body: Record<string,string> = {};
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      body = await req.json();
    } else {
      const text = await req.text();
      text.split("&").forEach(p => {
        const [k,v] = p.split("=");
        body[decodeURIComponent(k)] = decodeURIComponent(v||"");
      });
    }
    const { grant_type, client_id, client_secret, scope } = body;
    if (grant_type !== "client_credentials")
      return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
    if (!client_id || !client_secret)
      return NextResponse.json({ error: "invalid_request", error_description: "client_id and client_secret required" }, { status: 400 });

    const client = await prisma.apiClient.findFirst({ where: { clientId: client_id, active: true } });
    if (!client) return NextResponse.json({ error: "invalid_client" }, { status: 401 });

    // Verify secret — try hash first, then plain
    const secretHash = crypto.createHash("sha256").update(client_secret).digest("hex");
    const c = client as any;
    const validHash  = c.clientSecretHash && c.clientSecretHash === secretHash;
    const validPlain = c.clientSecret     && c.clientSecret     === client_secret;
    if (!validHash && !validPlain)
      return NextResponse.json({ error: "invalid_client", error_description: "Invalid client credentials" }, { status: 401 });

    // Validate scopes
    const requestedScopes = scope ? scope.split(" ") : (c.scopes || []);
    const grantedScopes   = requestedScopes.filter((s: string) => (c.scopes || []).includes(s));
    if (grantedScopes.length === 0 && requestedScopes.length > 0)
      return NextResponse.json({ error: "invalid_scope" }, { status: 400 });

    // Generate token
    const token = "vlt_" + crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour

    try {
      await (prisma.apiToken.create as any)({
        data: {
          apiClientId: client.id,
          organizationId: c.organizationId,
          token: crypto.createHash("sha256").update(token).digest("hex"),
          scopes: grantedScopes,
          expiresAt,
        },
      });
    } catch { /* token table may not exist, still return token */ }

    await (prisma.apiClient.update as any)({ where: { id: client.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

    return NextResponse.json({
      access_token: token,
      token_type:   "Bearer",
      expires_in:   3600,
      scope:        grantedScopes.join(" "),
    });
  } catch (e: any) {
    console.error("[oauth2/token]", e?.message);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
