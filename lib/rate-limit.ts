// Fixed-window limiter held in memory. On serverless each warm instance keeps its own counts, so this blunts
// bursts and token guessing from one client but is not a global cap — put the platform firewall in front for that.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  if (buckets.size > 5000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) { buckets.set(key, { count: 1, resetAt: now + windowMs }); return { ok: true, retryAfterSec: 0 }; }
  b.count++;
  return b.count > limit ? { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) } : { ok: true, retryAfterSec: 0 };
}

/** Limits per route group. Public endpoints are token-gated but unauthenticated, so they get the tightest caps. */
export function limitFor(pathname: string, method: string): { name: string; limit: number; windowMs: number } | null {
  if (pathname.startsWith("/api/auth/") || pathname === "/api/supplier/login") return { name: "auth", limit: 10, windowMs: 60_000 };
  if (pathname.startsWith("/api/public/")) return { name: method === "GET" ? "public-read" : "public-write", limit: method === "GET" ? 60 : 20, windowMs: 60_000 };
  return null;
}
