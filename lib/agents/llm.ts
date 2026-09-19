import { z } from "zod";

// One interface over the LLM providers so agents never care which one runs.
// Free tiers today (Groq, then Gemini); switch to Claude for paying customers
// just by setting ANTHROPIC_API_KEY (or LLM_PROVIDER=anthropic) — no code change.
//
// Agents ask for JSON that must match a zod schema instead of relying on each
// provider's native tool-calling, which is unreliable on free models. If the
// reply is malformed the error is fed back once so the model can correct itself.

export type LlmProvider = "groq" | "gemini" | "anthropic";

export function activeProvider(): LlmProvider | null {
  const forced = process.env.LLM_PROVIDER as LlmProvider | undefined;
  const has: Record<LlmProvider, boolean> = {
    groq: !!process.env.GROQ_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
  };
  if (forced && has[forced]) return forced;
  return (["groq", "gemini", "anthropic"] as LlmProvider[]).find(p => has[p]) ?? null;
}

export function llmConfigured(): boolean {
  return activeProvider() !== null;
}

type Msg = { role: "user" | "assistant"; content: string };

async function callProvider(provider: LlmProvider, system: string, messages: Msg[]): Promise<string> {
  const timeout = AbortSignal.timeout(30_000);

  if (provider === "groq") {
    const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        // gpt-oss is a reasoning model: its hidden reasoning counts against this
        // budget, and a truncated reply comes back as a 400 "failed to generate JSON".
        max_tokens: 4096,
        ...(model.startsWith("openai/gpt-oss") && { reasoning_effort: "low" }),
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, ...messages],
      }),
      signal: timeout,
    });
    if (!res.ok) throw new LlmError(`Groq ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`, res.status);
    return (await res.json())?.choices?.[0]?.message?.content ?? "";
  }

  if (provider === "gemini") {
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: { temperature: 0.1, maxOutputTokens: 1500, responseMimeType: "application/json" },
      }),
      signal: timeout,
    });
    if (!res.ok) throw new LlmError(`Gemini ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`, res.status);
    return (await res.json())?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: 1500,
      temperature: 0.1,
      system: system + "\n\nRespond with ONLY the JSON object, no prose or code fences.",
      messages,
    }),
    signal: timeout,
  });
  if (!res.ok) throw new LlmError(`Anthropic ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`, res.status);
  return (await res.json())?.content?.find((c: { type: string }) => c.type === "text")?.text ?? "";
}

export class LlmError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

function extractJson(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(cleaned); }
  catch {
    // Some models wrap the object in prose — take the outermost braces.
    const a = cleaned.indexOf("{"), b = cleaned.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(cleaned.slice(a, b + 1));
    throw new Error("Reply was not valid JSON");
  }
}

/**
 * Asks the model for a JSON object matching `schema`. Retries once with the
 * validation error if the first reply doesn't match, and once more on a
 * rate-limit (free tiers hit 429s often).
 */
export async function llmJson<T>(opts: { system: string; messages: Msg[]; schema: z.ZodType<T> }): Promise<T> {
  const provider = activeProvider();
  if (!provider) throw new LlmError("No LLM configured — set GROQ_API_KEY (free) or GEMINI_API_KEY in the environment");

  const messages = [...opts.messages];
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    let raw: string;
    try {
      raw = await callProvider(provider, opts.system, messages);
    } catch (e) {
      // 429 = rate limited; 400/5xx from a free tier is usually a one-off bad
      // generation or a blip, and a second try at low temperature typically works.
      const transient = e instanceof LlmError && (e.status === 429 || e.status === 400 || (e.status ?? 0) >= 500);
      if (transient && attempt < 2) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw e;
    }
    try {
      return opts.schema.parse(extractJson(raw));
    } catch (e) {
      lastError = e instanceof z.ZodError ? e.issues.map(i => `${i.path.join(".") || "reply"}: ${i.message}`).join("; ") : (e as Error).message;
      messages.push({ role: "assistant", content: raw }, { role: "user", content: `That reply was rejected: ${lastError}. Reply again with ONLY a corrected JSON object.` });
    }
  }
  throw new LlmError(`Model did not return a valid reply: ${lastError}`);
}
