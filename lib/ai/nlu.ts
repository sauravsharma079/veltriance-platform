// Free-text procurement requirement extraction ("I need 500 laptops delivered to
// Singapore before next month" → structured fields). Two tiers:
//
// 1. If ANTHROPIC_API_KEY is set, calls the real Claude Messages API for genuine
//    LLM understanding.
// 2. Otherwise falls back to keyword/regex heuristics — much weaker, but honest
//    and functional without any external credential. The UI should make clear
//    which tier produced a given extraction.
//
// No SDK dependency — this is a single documented REST call.

export type ExtractedRequirement = {
  title: string;
  category: string | null;
  quantity: number | null;
  deliveryLocation: string | null;
  requiredDate: string | null; // free-text phrase (e.g. "next month"), parsed downstream by intake/submit
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  businessJustification: string | null;
  confidence: "llm" | "heuristic";
};

const PRIORITY_KEYWORDS: [RegExp, ExtractedRequirement["priority"]][] = [
  [/\b(urgent|asap|critical|emergency|immediately)\b/i, "CRITICAL"],
  [/\b(high priority|important|soon)\b/i, "HIGH"],
  [/\b(low priority|whenever|no rush)\b/i, "LOW"],
];

function heuristicExtract(text: string, categories: string[]): ExtractedRequirement {
  const quantityMatch = text.match(/\b(\d{1,6})\b/);
  const quantity = quantityMatch ? parseInt(quantityMatch[1]) : null;

  const category = categories.find(c => text.toLowerCase().includes(c.toLowerCase())) ?? null;

  const locationMatch = text.match(/\b(?:to|in|at|for)\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)\b/);
  const deliveryLocation = locationMatch ? locationMatch[1] : null;

  const dateMatch = text.match(/\b(today|tomorrow|asap|this week|next week|this month|next month|in \d+ days?|in \d+ weeks?)\b/i);
  const requiredDate = dateMatch ? dateMatch[0] : null;

  let priority: ExtractedRequirement["priority"] = "MEDIUM";
  for (const [re, p] of PRIORITY_KEYWORDS) if (re.test(text)) { priority = p; break; }

  return {
    title: text.length > 80 ? text.slice(0, 77) + "..." : text,
    category, quantity, deliveryLocation, requiredDate, priority,
    businessJustification: null,
    confidence: "heuristic",
  };
}

async function llmExtract(text: string, categories: string[], apiKey: string): Promise<ExtractedRequirement | null> {
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";
  const systemPrompt = `You are a procurement intake assistant. Extract structured fields from a free-text purchase request. Respond with ONLY a JSON object (no markdown fences, no prose) matching this exact shape:
{"title": string, "category": string|null, "quantity": number|null, "deliveryLocation": string|null, "requiredDate": string|null, "priority": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "businessJustification": string|null}

Rules:
- "title" is a short human-readable summary of the request (max 80 chars).
- "category" MUST be one of this organization's existing categories if any reasonably match, else your best short category guess, else null: [${categories.join(", ")}]
- "requiredDate" should be the requester's own words for timing (e.g. "next month", "ASAP", "March 15") — do not compute a calendar date yourself.
- "priority" defaults to MEDIUM unless urgency language is present.
- "businessJustification" is a one-sentence reason if the text implies one, else null.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: text }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) { console.error("[nlu] Anthropic API error", res.status, await res.text().catch(() => "")); return null; }
    const json = await res.json();
    const raw = json?.content?.[0]?.text;
    if (!raw) return null;
    const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\n?/, "").replace(/```$/, ""));
    return {
      title: String(parsed.title ?? text.slice(0, 80)),
      category: parsed.category ?? null,
      quantity: parsed.quantity != null ? Number(parsed.quantity) : null,
      deliveryLocation: parsed.deliveryLocation ?? null,
      requiredDate: parsed.requiredDate ?? null,
      priority: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(parsed.priority) ? parsed.priority : "MEDIUM",
      businessJustification: parsed.businessJustification ?? null,
      confidence: "llm",
    };
  } catch (e: any) {
    console.error("[nlu] llmExtract failed", e?.message);
    return null;
  }
}

export async function extractRequirement(text: string, categories: string[]): Promise<ExtractedRequirement> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const result = await llmExtract(text, categories, apiKey);
    if (result) return result;
    // LLM call failed (network/quota/parse error) — degrade gracefully rather than error out.
  }
  return heuristicExtract(text, categories);
}
