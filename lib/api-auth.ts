import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

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
