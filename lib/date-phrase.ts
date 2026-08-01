// Turns a requester's own words for timing ("next month", "ASAP", "tomorrow",
// "in 2 weeks", or a literal date) into a real Date. Shared between the intake
// submit route (server-side parsing) and Aria (client-side validation, so an
// unrecognized phrase gets re-asked instead of silently becoming null).

export function parseRequiredDate(text: string | null | undefined): Date | null {
  if (!text) return null;
  const s = text.toLowerCase().trim();
  const now = new Date();
  if (s === "asap" || s === "today") return now;
  if (s === "tomorrow") { const x = new Date(now); x.setDate(now.getDate() + 1); return x; }
  if (s.includes("next week")) { const x = new Date(now); x.setDate(now.getDate() + 7); return x; }
  if (s.includes("this week")) { const x = new Date(now); x.setDate(now.getDate() + (5 - now.getDay())); return x; }
  const weeksMatch = s.match(/in (\d+) weeks?/);
  if (weeksMatch) { const x = new Date(now); x.setDate(now.getDate() + 7 * parseInt(weeksMatch[1])); return x; }
  const daysMatch = s.match(/in (\d+) days?/);
  if (daysMatch) { const x = new Date(now); x.setDate(now.getDate() + parseInt(daysMatch[1])); return x; }
  if (s.includes("2 week") || s.includes("two week")) { const x = new Date(now); x.setDate(now.getDate() + 14); return x; }
  if (s.includes("this month")) return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  if (s.includes("next month")) return new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const p = new Date(text);
  return isNaN(p.getTime()) ? null : p;
}

export function isRecognizedDatePhrase(text: string): boolean {
  return parseRequiredDate(text) !== null;
}
