import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { generateJSON, LlmUnavailableError } from "@/lib/llm";
import { systemPrompt } from "@/lib/prompts";
import { llmProfileSchema } from "@/lib/schemas";
import { FIELDS, onlyValidFields } from "@/lib/taxonomy";
import { rateLimit } from "@/lib/ratelimit";

export const maxDuration = 30;

const bodySchema = z.object({
  headline: z.string().max(80).default(""),
  summary: z.string().max(800).default(""),
  fields: z.array(z.string()).max(10).default([]),
});

/** Keyword fallback: suggest fields whose label words appear in the text. */
function keywordSuggest(text: string): string[] {
  const t = text.toLowerCase();
  const extra: Record<string, string[]> = {
    "ai-ml": [" ai ", "machine learning", "deep learning", "llm", "artificial intelligence"],
    "data-science": ["data", "analytics", "statistics"],
    "neuroscience": ["brain", "neuro"],
    "climate": ["climate", "carbon", "emissions"],
    "digital-health": ["health tech", "medtech", "digital health", "e-health"],
    "public-health": ["epidemiology", "public health"],
    "education-learning": ["education", "learning", "teaching"],
  };
  return FIELDS.filter((f) => {
    const words = f.label.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 4);
    return words.some((w) => t.includes(w)) || (extra[f.slug] || []).some((k) => ` ${t} `.includes(k));
  }).map((f) => f.slug);
}

export const POST = route(async (req) => {
  const user = await requireUser({ onboarded: false });
  const body = await readJson(req, bodySchema);
  const text = `${body.headline}\n${body.summary}`.trim();
  if (text.length < 15) return json({ fields: [], freeTags: [], targetRoles: [] });
  try {
    await rateLimit("suggest", String(user._id), { exempt: user.isAdmin });
    const out = await generateJSON({
      feature: "profileSuggestions",
      label: "profile-suggest",
      system: await systemPrompt("profile"),
      user: JSON.stringify({ headline: body.headline, summary: body.summary, chosenFields: body.fields }),
      schema: llmProfileSchema,
      maxOutputTokens: 600,
    });
    return json({
      fields: onlyValidFields(out.fields).slice(0, 6),
      freeTags: out.freeTags.map((t) => t.toLowerCase().trim().slice(0, 40)).filter(Boolean).slice(0, 8),
      targetRoles: out.targetRoles.map((t) => t.trim().slice(0, 60)).filter(Boolean).slice(0, 5),
    });
  } catch (err) {
    if (!(err instanceof LlmUnavailableError) && !(err instanceof Error && /Daily limit/.test(err.message))) throw err;
    return json({ fields: keywordSuggest(` ${text} `).slice(0, 6), freeTags: [], targetRoles: [], basic: true });
  }
});
