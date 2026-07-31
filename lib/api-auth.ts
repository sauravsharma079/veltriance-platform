import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/tenant";

export type ApiContext = { clientId: string; organizationId: string; scopes: string[] };

function hashToken(t: string) { return createHash("sha256").update(t).digest("hex"); }

export async function validateApiRequest(
  req: NextRequest, requiredScope: string
): Promise<{ ctx: ApiContext } | { error: string; status: number }> {
  const h = req.headers.get("authorization") ?? "";
  if (!h.startsWith("Bearer ")) return { error: "Missing Authorization header", status: 401 };
  const tok = await prisma.apiToken.findUnique({
    where: { tokenHash: hashToken(h.slice(7)) },
    include: { apiClient: true },
  });
  if (!tok)                      return { error: "Invalid token", status: 401 };
  if (tok.revokedAt)             return { error: "Token revoked", status: 401 };
  if (tok.expiresAt < new Date())return { error: "Token expired", status: 401 };
  if (!tok.apiClient.active)     return { error: "Client inactive", status: 403 };
  if (!tok.scopes.includes(requiredScope))
    return { error: `Insufficient scope. Required: ${requiredScope}`, status: 403 };
  return { ctx: { clientId: tok.apiClient.clientId, organizationId: tok.apiClient.organizationId, scopes: tok.scopes } };
}

export type UploadActor = { organizationId: string; userId: string | null; userName: string; source: "api" | "session" };

/**
 * Bulk-upload endpoints (CSV / integrator uploads) need to work two ways:
 * from the dashboard UI (Supabase session cookie) and from an external
 * caller with an OAuth 2.0 bearer token (Postman, an integration, etc).
 * Bearer takes priority when present so API callers never fall through
 * to a session check that will always reject them.
 */
export async function resolveUploadActor(
  req: NextRequest, requiredScope: string
): Promise<{ actor: UploadActor } | { error: string; status: number }> {
  if ((req.headers.get("authorization") ?? "").startsWith("Bearer ")) {
    const result = await validateApiRequest(req, requiredScope);
    if ("error" in result) return result;
    return { actor: { organizationId: result.ctx.organizationId, userId: null, userName: `API client (${result.ctx.clientId})`, source: "api" } };
  }

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };
  const org = await getCurrentOrganization();
  if (!org) return { error: "Not found", status: 404 };
  const profile = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!profile) return { error: "Profile not found", status: 404 };
  return { actor: { organizationId: org.id, userId: profile.id, userName: profile.name, source: "session" } };
}

/**
 * Same dual-auth shape as resolveUploadActor, for read endpoints that also
 * need to work both from the dashboard UI and from an external API caller
 * with a read-scoped bearer token (e.g. GET /api/catalogs).
 */
export async function resolveReadActor(
  req: NextRequest, requiredScope: string
): Promise<{ actor: UploadActor } | { error: string; status: number }> {
  return resolveUploadActor(req, requiredScope);
}

export const apiOk  = (data: unknown, meta?: Record<string, unknown>) => Response.json({ ...meta, data });
export const apiErr = (msg: string, status: number) => Response.json({ error: msg }, { status });

export function parsePagination(req: NextRequest) {
  const u = new URL(req.url);
  const o = parseInt(u.searchParams.get("offset") ?? "0");
  const l = Math.min(parseInt(u.searchParams.get("limit") ?? "50"), 200);
  return { offset: isNaN(o) ? 0 : o, limit: isNaN(l) ? 50 : l };
}

export function pagMeta(total: number, offset: number, limit: number, base: string) {
  return { pagination: { total, offset, limit,
    ...(offset + limit < total ? { next: `${base}?offset=${offset + limit}&limit=${limit}` } : {}),
    ...(offset > 0 ? { prev: `${base}?offset=${Math.max(0, offset - limit)}&limit=${limit}` } : {}),
  }};
}
