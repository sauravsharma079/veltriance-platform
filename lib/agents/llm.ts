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

/** Every configured provider, primary first — used to fail over when one is exhausted. */
export function configuredProviders(): LlmProvider[] {
  const primary = activeProvider();
  if (!primary) return [];
  const has: Record<LlmProvider, boolean> = { groq: !!process.env.GROQ_API_KEY, gemini: !!process.env.GEMINI_API_KEY, anthropic: !!process.env.ANTHROPIC_API_KEY };
  return [primary, ...(["groq", "gemini", "anthropic"] as LlmProvider[]).filter(p => p !== primary && has[p])];
}

export function llmConfigured(): boolean {
  return activeProvider() !== null;
}

/** Seconds a provider tells us to wait ("try again in 9m39s" / "14.07s"), or null. */
function retryAfterSeconds(message: string): number | null {
  const m = /try again in (?:(\d+)m)?(?:([\d.]+)s)?/i.exec(message);
  if (!m || (!m[1] && !m[2])) return null;
  return (m[1] ? parseInt(m[1]) * 60 : 0) + (m[2] ? parseFloat(m[2]) : 0);
}

type Msg = { role: "user" | "assistant"; content: string };

/**
 * Gemini model names get retired for new accounts without much notice (2.0, then 2.5, both
 * did). A pinned model is fast and predictable, so it's tried first; if Google says it's gone
 * (404) we fall back to the always-current alias, which is slower but never retired.
 * Override the pinned one with GEMINI_MODEL.
 */
const GEMINI_MODELS = () => Array.from(new Set([process.env.GEMINI_MODEL || "gemini-3.6-flash", "gemini-flash-latest"]));

async function geminiGenerate(body: unknown, signal: AbortSignal): Promise<Response> {
  let res!: Response;
  for (const model of GEMINI_MODELS()) {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify(body), signal,
    });
    if (res.status !== 404) return res;
    console.warn(`[llm] Gemini model ${model} not available (404) — trying the next one`);
  }
  return res;
}

async function callProvider(provider: LlmProvider, system: string, messages: Msg[], maxTokens: number, strictJson = true): Promise<string> {
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
        max_tokens: Math.max(maxTokens, 8192),
        ...(model.startsWith("openai/gpt-oss") && { reasoning_effort: "low" }),
        // Groq's strict JSON mode rejects some generations outright; we validate the reply ourselves anyway.
        ...(strictJson && { response_format: { type: "json_object" } }),
        messages: [{ role: "system", content: system }, ...messages],
      }),
      signal: timeout,
    });
    if (!res.ok) throw await apiError("Groq", res);
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "";
    if (!content) console.warn("[llm] Groq returned no content", { finish_reason: json?.choices?.[0]?.finish_reason, usage: json?.usage });
    return content;
  }

  if (provider === "gemini") {
    const res = await geminiGenerate({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { temperature: 0.1, maxOutputTokens: Math.max(maxTokens, 8192), responseMimeType: "application/json" },
    }, timeout);
    if (!res.ok) throw await apiError("Gemini", res);
    return (await res.json())?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: maxTokens,
      temperature: 0.1,
      system: system + "\n\nRespond with ONLY the JSON object, no prose or code fences.",
      messages,
    }),
    signal: timeout,
  });
  if (!res.ok) throw await apiError("Anthropic", res);
  return (await res.json())?.content?.find((c: { type: string }) => c.type === "text")?.text ?? "";
}

/**
 * Providers return a JSON blob on error. Keep the useful sentence (and any "try again in …" hint the
 * retry logic reads) rather than dumping the whole object into a message a person will see.
 */
async function apiError(provider: string, res: Response): Promise<LlmError> {
  const raw = await res.text().catch(() => "");
  let msg = raw;
  try { const j = JSON.parse(raw); msg = j?.error?.message ?? j?.message ?? raw; } catch { /* not JSON */ }
  return new LlmError(`${provider} ${res.status}: ${String(msg).replace(/\s+/g, " ").slice(0, 300)}`, res.status);
}

/** A spent quota (daily/plan limit) won't recover in seconds, so retrying it only makes people wait. */
function isSpentQuota(e: unknown): boolean {
  return e instanceof LlmError && e.status === 429 && /exceeded your current quota|per day|\bTPD\b|billing details|quota exceeded/i.test(e.message);
}

const PROVIDER_LABEL: Record<LlmProvider, string> = { groq: "Groq", gemini: "Gemini", anthropic: "Claude" };

/** When every provider we tried is rate-limited, say so plainly instead of surfacing one provider's raw error. */
function exhausted(providers: LlmProvider[], errors: unknown[]): LlmError | null {
  if (errors.length === 0 || !errors.every(e => e instanceof LlmError && e.status === 429)) return null;
  return new LlmError(`The AI service is at its usage limit right now (${providers.map(p => PROVIDER_LABEL[p]).join(" and ")}). That's a limit of the free plan and usually clears within a few hours; adding a paid API key removes it. Please try again later.`, 429);
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
async function jsonWith<T>(provider: LlmProvider, opts: { system: string; messages: Msg[]; schema: z.ZodType<T>; maxTokens?: number }): Promise<T> {
  const messages = [...opts.messages];
  let lastError = "";
  let strictJson = true;
  for (let attempt = 0; attempt < 5; attempt++) {
    let raw: string;
    try {
      raw = await callProvider(provider, opts.system, messages, opts.maxTokens ?? 1500, strictJson);
    } catch (e) {
      // 429 = rate limited; 400/5xx from a free tier is usually a one-off bad
      // generation or a blip, and a second try at low temperature typically works.
      const transient = e instanceof LlmError && (e.status === 429 || e.status === 400 || (e.status ?? 0) >= 500);
      if (e instanceof LlmError && e.message.includes("json_validate_failed")) strictJson = false; // retry without Groq's strict mode
      if (e instanceof LlmError && e.message.includes("tool_use_failed"))
        messages.push({ role: "user", content: "Reminder: you cannot call tools natively. Reply with ONLY the JSON object described in your instructions." });
      if (isSpentQuota(e)) throw e; // fail over to the next provider straight away
      if (transient && attempt < 4) {
        // Free tiers say exactly how long to back off ("try again in 14.07s") — honour it, capped.
        const hinted = retryAfterSeconds(e.message);
        if (hinted !== null && hinted > 30) throw e; // a daily quota, not a blip — let the caller fail over
        await new Promise(r => setTimeout(r, hinted !== null ? Math.ceil(hinted + 1) * 1000 : 1500 * (attempt + 1)));
        continue;
      }
      throw e;
    }
    // A blank reply (seen intermittently from free-tier reasoning models) has nothing to
    // correct — just ask again rather than feeding an empty turn back.
    if (!raw.trim()) { lastError = "The model returned an empty reply"; continue; }
    try {
      return opts.schema.parse(extractJson(raw));
    } catch (e) {
      lastError = e instanceof z.ZodError ? e.issues.map(i => `${i.path.join(".") || "reply"}: ${i.message}`).join("; ") : (e as Error).message;
      messages.push({ role: "assistant", content: raw }, { role: "user", content: `That reply was rejected: ${lastError}. Reply again with ONLY a corrected JSON object.` });
    }
  }
  throw new LlmError(`Model did not return a valid reply: ${lastError}`);
}

export async function llmJson<T>(opts: { system: string; messages: Msg[]; schema: z.ZodType<T>; maxTokens?: number }): Promise<T> {
  const providers = configuredProviders();
  if (providers.length === 0) throw new LlmError("No LLM configured — set GROQ_API_KEY (free) or GEMINI_API_KEY in the environment");
  let last: unknown;
  const errors: unknown[] = [];
  for (const p of providers) {
    try { return await jsonWith(p, opts); }
    catch (e) {
      last = e; errors.push(e);
      if (!(e instanceof LlmError)) throw e;
      console.warn(`[llm] ${p} failed (${e.message.slice(0, 120)})${providers.length > 1 ? " — trying the next provider" : ""}`);
    }
  }
  throw exhausted(providers, errors) ?? last;
}

/**
 * Plain-text generation for long documents (a whole contract). Putting a long
 * document inside a JSON string is error-prone — escaping mistakes get the whole
 * reply rejected — so agents use JSON only for decisions and this for prose.
 */
export async function llmText(opts: { system: string; user: string; maxTokens?: number }): Promise<string> {
  const providers = configuredProviders();
  if (providers.length === 0) throw new LlmError("No LLM configured — set GROQ_API_KEY (free) or GEMINI_API_KEY in the environment");
  let last: unknown;
  const errors: unknown[] = [];
  for (const p of providers) {
    try { return await textWith(p, opts); }
    catch (e) {
      last = e; errors.push(e);
      if (!(e instanceof LlmError)) throw e;
      console.warn(`[llm] ${p} failed (${e.message.slice(0, 120)})${providers.length > 1 ? " — trying the next provider" : ""}`);
    }
  }
  throw exhausted(providers, errors) ?? last;
}

async function textWith(provider: LlmProvider, opts: { system: string; user: string; maxTokens?: number }): Promise<string> {
  const maxTokens = opts.maxTokens ?? 6000;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await callProviderText(provider, opts.system, opts.user, maxTokens);
      if (text.trim().length > 0) return text.trim().replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "");
      lastError = new LlmError("The model returned an empty reply");
    } catch (e) {
      lastError = e;
      const transient = e instanceof LlmError && (e.status === 429 || (e.status ?? 0) >= 500 || e.status === undefined);
      if (!transient || isSpentQuota(e)) throw e;
      const hinted = e instanceof Error ? retryAfterSeconds(e.message) : null;
      if (hinted !== null && hinted > 30) throw e; // daily quota — let the caller fail over
      await new Promise(r => setTimeout(r, hinted !== null ? Math.ceil(hinted + 1) * 1000 : 2000 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new LlmError("Text generation failed");
}

async function callProviderText(provider: LlmProvider, system: string, user: string, maxTokens: number): Promise<string> {
  const timeout = AbortSignal.timeout(90_000);
  if (provider === "groq") {
    const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({ model, temperature: 0.2, max_tokens: maxTokens, ...(model.startsWith("openai/gpt-oss") && { reasoning_effort: "low" }), messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      signal: timeout,
    });
    if (!res.ok) throw await apiError("Groq", res);
    const json = await res.json();
    if (json?.choices?.[0]?.finish_reason === "length") throw new LlmError("The document is too long to generate in one go", 413);
    return json?.choices?.[0]?.message?.content ?? "";
  }
  if (provider === "gemini") {
    const res = await geminiGenerate({
      systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: Math.max(maxTokens, 16000) },
    }, timeout);
    if (!res.ok) throw await apiError("Gemini", res);
    return (await res.json())?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5", max_tokens: maxTokens, temperature: 0.2, system, messages: [{ role: "user", content: user }] }),
    signal: timeout,
  });
  if (!res.ok) throw await apiError("Anthropic", res);
  return (await res.json())?.content?.find((c: { type: string }) => c.type === "text")?.text ?? "";
}
