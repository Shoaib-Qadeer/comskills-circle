import type { ZodType } from "zod";
import { collections } from "./db";
import { getSettings, type AiFeature } from "./settings";
import type { LlmLogDoc } from "./types";

export class LlmUnavailableError extends Error {}

const TIMEOUT_MS = 25_000;

function envConfig() {
  return {
    provider: (process.env.LLM_PROVIDER || "gemini").toLowerCase(),
    apiKey: process.env.LLM_API_KEY || "",
    model: process.env.LLM_MODEL || "",
  };
}

export async function activeModel(): Promise<string> {
  const s = await getSettings();
  return s.ai.model || envConfig().model;
}

export function llmKeyConfigured(): boolean {
  return Boolean(envConfig().apiKey);
}

export function llmProvider(): string {
  return envConfig().provider;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Atomically reserves one call from today's budget. Throws when the call or token cap is reached. */
async function reserveCall(callLimit: number, tokenLimit: number) {
  const { usage } = await collections();
  const doc = await usage.findOneAndUpdate({ _id: today() }, { $inc: { llmCalls: 1 } }, { upsert: true, returnDocument: "after" });
  const calls = doc?.llmCalls ?? 1;
  const tokens = (doc?.inputTokens ?? 0) + (doc?.outputTokens ?? 0);
  if (calls > callLimit) throw new LlmUnavailableError("Daily AI call limit reached");
  if (tokens >= tokenLimit) throw new LlmUnavailableError("Daily AI token budget reached");
}

async function record(entry: Omit<LlmLogDoc, "_id">) {
  try {
    const { usage } = await collections();
    const db = usage.db;
    await Promise.all([
      usage.updateOne(
        { _id: today() },
        { $inc: { inputTokens: entry.inputTokens, outputTokens: entry.outputTokens, errors: entry.ok ? 0 : 1 } },
        { upsert: true },
      ),
      db.collection<LlmLogDoc>("llmLog").insertOne(entry as LlmLogDoc),
    ]);
  } catch (e) {
    console.error("[llm] could not record usage", e);
  }
}

export async function llmUsage(days = 14): Promise<{ date: string; calls: number; inputTokens: number; outputTokens: number; errors: number }[]> {
  const { usage } = await collections();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
    out.push(d);
  }
  const docs = await usage.find({ _id: { $in: out } }).toArray();
  const byId = new Map(docs.map((d) => [d._id, d]));
  return out.map((date) => {
    const d = byId.get(date);
    return { date, calls: d?.llmCalls ?? 0, inputTokens: d?.inputTokens ?? 0, outputTokens: d?.outputTokens ?? 0, errors: d?.errors ?? 0 };
  });
}

export async function llmRecentLog(limit = 50): Promise<(Omit<LlmLogDoc, "_id" | "at"> & { at: string })[]> {
  const { usage } = await collections();
  const docs = await usage.db.collection<LlmLogDoc>("llmLog").find({}).sort({ at: -1 }).limit(limit).toArray();
  return docs.map(({ _id, at, ...rest }) => ({ ...rest, at: at.toISOString() }));
}

type RawResult = { text: string; inputTokens?: number; outputTokens?: number };

async function callProvider(model: string, system: string, user: string, maxOutputTokens: number, temperature: number): Promise<RawResult> {
  const { provider, apiKey } = envConfig();
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  if (provider === "gemini") {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature, maxOutputTokens, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p: { text?: string }) => p.text || "").join("");
    return { text, inputTokens: data?.usageMetadata?.promptTokenCount, outputTokens: data?.usageMetadata?.candidatesTokenCount };
  }

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        max_tokens: maxOutputTokens,
        temperature,
        system: system + "\nRespond with a single JSON object and nothing else.",
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const text = (data?.content ?? []).map((b: { type: string; text?: string }) => (b.type === "text" ? b.text : "")).join("");
    return { text, inputTokens: data?.usage?.input_tokens, outputTokens: data?.usage?.output_tokens };
  }

  if (provider === "openai" || provider === "openrouter") {
    const url = provider === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
    const res = await fetch(url, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_completion_tokens: maxOutputTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`${provider} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    return { text: data?.choices?.[0]?.message?.content ?? "", inputTokens: data?.usage?.prompt_tokens, outputTokens: data?.usage?.completion_tokens };
  }

  throw new Error(`Unknown LLM_PROVIDER "${provider}"`);
}

/** Pulls the first JSON object out of a model reply (handles ```json fences and stray prose). */
export function parseJsonLoose(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("No JSON object in model reply");
  }
}

/**
 * Calls the configured provider and validates the JSON reply against `schema`.
 * Retries once with the validation error appended. Throws LlmUnavailableError when AI is off,
 * the feature is switched off, the key/model is missing, or a daily cap is hit — callers then
 * fall back to rule-based behaviour.
 */
export async function generateJSON<T>(opts: {
  feature: AiFeature;
  system: string;
  user: string;
  schema: ZodType<T>;
  maxOutputTokens?: number;
  label?: string;
}): Promise<T> {
  const settings = await getSettings();
  const { apiKey } = envConfig();
  const model = settings.ai.model || envConfig().model;
  if (!settings.ai.enabled) throw new LlmUnavailableError("AI is switched off");
  if (!settings.ai.features[opts.feature]) throw new LlmUnavailableError(`AI ${opts.feature} is switched off`);
  if (!apiKey || !model) throw new LlmUnavailableError("LLM not configured");

  const max = opts.maxOutputTokens ?? 2048;
  const label = opts.label || opts.feature;
  let user = opts.user;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    await reserveCall(settings.ai.dailyCallLimit, settings.ai.dailyTokenLimit);
    const started = Date.now();
    try {
      const raw = await callProvider(model, opts.system, user, max, settings.ai.temperature);
      const parsed = opts.schema.safeParse(parseJsonLoose(raw.text));
      await record({
        at: new Date(),
        label,
        model,
        ok: parsed.success,
        inputTokens: raw.inputTokens ?? 0,
        outputTokens: raw.outputTokens ?? 0,
        ms: Date.now() - started,
        error: parsed.success ? null : `Invalid JSON shape: ${parsed.error.message.slice(0, 200)}`,
      });
      if (parsed.success) return parsed.data;
      lastErr = parsed.error;
      user = `${opts.user}\n\nYour previous reply did not match the required JSON schema: ${parsed.error.message.slice(0, 500)}\nReturn corrected JSON only.`;
    } catch (err) {
      if (err instanceof LlmUnavailableError) throw err;
      lastErr = err;
      await record({
        at: new Date(),
        label,
        model,
        ok: false,
        inputTokens: 0,
        outputTokens: 0,
        ms: Date.now() - started,
        error: err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300),
      });
    }
  }
  console.error(`[llm] ${label} failed`, lastErr);
  throw new LlmUnavailableError("LLM call failed");
}
