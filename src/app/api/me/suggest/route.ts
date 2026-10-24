import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { generateJSON, LlmUnavailableError } from "@/lib/llm";
import { systemPrompt } from "@/lib/prompts";
import { llmProfileSchema } from "@/lib/schemas";
import { FIELDS, onlyValidFields } from "@/lib/taxonomy";
import { rateLimit } from "@/lib/ratelimit";
import { scrubForLlm } from "@/lib/pii";

export const maxDuration = 30;

const bodySchema = z.object({
  text: z.string().max(3000).default(""),
  chosen: z.array(z.string()).max(10).default([]),
});

const EXTRA: Record<string, string[]> = {
  "ai-ml": [" ai ", "machine learning", "deep learning", "llm", "neural", "nlp", "computer vision"],
  "data-science": ["data", "analytics", "pandas", "visualization"],
  "computer-science": ["computer science", "algorithms", "programming"],
  "software-eng": ["software", "web", "app", "backend", "frontend", "flutter", "react"],
  bioinformatics: ["bioinformatics", "genomics", "sequencing", "blast", "rna-seq", "proteomics"],
  biotechnology: ["biotech", "fermentation", "bioprocess"],
  "molecular-biology": ["pcr", "gene", "genetic", "dna", "crispr", "molecular"],
  microbiology: ["bacteria", "microbe", "antimicrobial", "microbio"],
  "medicine-health": ["mbbs", "clinical", "hospital", "medical", "disease"],
  "public-health": ["epidemiology", "public health", "community health"],
  climate: ["climate", "carbon", "emissions", "flood"],
  "environmental-science": ["environment", "pollution", "water quality", "ecology"],
  education: ["teaching", "education", "students", "school"],
  entrepreneurship: ["startup", "founder", "business plan"],
  "research-academia": ["research", "phd", "thesis", "publication"],
  "social-impact": ["ngo", "volunteer", "community", "social impact"],
};

/** Keyword fallback when the AI is off or out of budget: fields whose label words appear in the text. */
function keywordSuggest(text: string): string[] {
  const t = ` ${text.toLowerCase()} `;
  return FIELDS.filter((f) => {
    const words = f.label.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 4);
    return words.some((w) => t.includes(w)) || (EXTRA[f.slug] || []).some((k) => t.includes(k));
  }).map((f) => f.slug);
}

/** Suggests taxonomy fields (and free tags) from what someone wrote about themselves or a project. */
export const POST = route(async (req) => {
  const user = await requireUser({ onboarded: false });
  const body = await readJson(req, bodySchema);
  const text = body.text.trim();
  if (text.length < 15) return json({ fields: [], freeTags: [] });
  try {
    await rateLimit("suggest", String(user._id), { exempt: user.isAdmin });
    const out = await generateJSON({
      feature: "profileSuggestions",
      label: "suggest-fields",
      system: await systemPrompt("profile"),
      // Names, emails, phone numbers and the university never go to the AI
      user: JSON.stringify({ text: scrubForLlm(text, { name: user.name, email: user.email, university: user.university }), chosenFields: body.chosen }),
      schema: llmProfileSchema,
      maxOutputTokens: 500,
    });
    return json({
      fields: onlyValidFields(out.fields).slice(0, 6),
      freeTags: out.freeTags.map((t) => t.toLowerCase().trim().slice(0, 40)).filter(Boolean).slice(0, 8),
    });
  } catch (err) {
    if (!(err instanceof LlmUnavailableError) && !(err instanceof Error && /limit/i.test(err.message))) throw err;
    return json({ fields: keywordSuggest(text).slice(0, 6), freeTags: [], basic: true });
  }
});
