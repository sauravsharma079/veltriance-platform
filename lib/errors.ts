/** Safe message from a caught value (catch clauses bind `unknown`). */
export function errorMessage(e: unknown, fallback = "Unknown error"): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return fallback;
}
