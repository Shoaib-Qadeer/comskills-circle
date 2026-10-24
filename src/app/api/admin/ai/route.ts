import { z } from "zod";
import { requireAdmin, ApiError } from "@/lib/auth";
import { route, json } from "@/lib/api";
import { generateJSON, llmRecentLog, LlmUnavailableError, activeModel } from "@/lib/llm";

export const maxDuration = 30;

export const GET = route(async () => {
  await requireAdmin();
  return json({ log: await llmRecentLog(60) });
});

/** Sends one tiny request so the admin can check the key, model and limits work. */
export const POST = route(async () => {
  await requireAdmin();
  const started = Date.now();
  try {
    const out = await generateJSON({
      feature: "extraction",
      label: "admin-test",
      system: 'Reply with JSON only: {"ok": true, "message": "<five words saying hello>"}',
      user: "Test from the Comskills Circle admin dashboard.",
      schema: z.object({ ok: z.boolean(), message: z.string() }),
      maxOutputTokens: 100,
    });
    return json({ ok: true, model: await activeModel(), ms: Date.now() - started, reply: out.message });
  } catch (err) {
    if (err instanceof LlmUnavailableError) {
      throw new ApiError(503, `${err.message}. Check the AI switch, the extraction feature toggle, the model name and LLM_API_KEY — the call log below shows the provider's error.`);
    }
    throw err;
  }
});
