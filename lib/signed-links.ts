import { createHmac, createHash, timingSafeEqual } from "crypto";

// Tamper-proof, expiring, single-purpose links for emails ("approve this", "confirm delivery").
// Nothing is stored: the link carries its claims and an HMAC signature made with a key derived from a
// server-only secret. The `k` (kind) claim is signed too, so a link issued for one purpose can never be
// replayed for another. Whether a link still has authority is decided by the caller from live state
// (is the approval still open? has the delivery already been confirmed?), not by the link itself.

const key = () => createHash("sha256").update(`veltriance-signed-link:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`).digest();
const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function signLink<T extends Record<string, unknown>>(kind: string, claims: T, ttlDays: number, now = Date.now()): string {
  const payload = b64(JSON.stringify({ ...claims, k: kind, e: now + ttlDays * 86_400_000 }));
  return `${payload}.${b64(createHmac("sha256", key()).update(payload).digest())}`;
}

export function verifyLink<T extends Record<string, unknown>>(token: string, kind: string, now = Date.now()): (T & { k: string; e: number }) | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig || token.length > 700) return null;
  const good = createHmac("sha256", key()).update(payload).digest();
  let given: Buffer;
  try { given = Buffer.from(sig, "base64url"); } catch { return null; }
  if (given.length !== good.length || !timingSafeEqual(given, good)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString()) as T & { k: string; e: number };
    return p.k === kind && typeof p.e === "number" && p.e > now ? p : null;
  } catch { return null; }
}
