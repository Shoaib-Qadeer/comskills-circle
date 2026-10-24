import { requireUser, ApiError } from "@/lib/auth";
import { route, json, type IdCtx } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { generateJSON, LlmUnavailableError } from "@/lib/llm";
import { systemPrompt } from "@/lib/prompts";
import { llmCoachSchema } from "@/lib/schemas";
import { rateLimit } from "@/lib/ratelimit";
import { getField } from "@/lib/taxonomy";
import { profileForLlm } from "@/lib/matching";
import type { CoachAdvice } from "@/lib/types";

export const maxDuration = 45;

/** "How should I approach this?" — tailored advice for one match, generated once and cached on the match. */
export const POST = route(async (req, ctx: IdCtx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const oid = toObjectId(id);
  if (!oid) throw new ApiError(404, "Not found");
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  const { matches, opportunities } = await collections();
  const match = await matches.findOne({ _id: oid, userId: user._id, kind: "opportunity" });
  if (!match) throw new ApiError(404, "Not found");
  if (match.coach && !refresh) return json({ coach: match.coach });
  const opp = await opportunities.findOne({ _id: match.targetId });
  if (!opp) throw new ApiError(404, "This opportunity was removed.");

  await rateLimit("coach", String(user._id), { exempt: user.isAdmin });
  try {
    const out = await generateJSON({
      feature: "coach",
      label: "coach",
      system: await systemPrompt("coach"),
      // No name, email, phone, university or links — only skills and goals
      user: JSON.stringify({
        student: profileForLlm(user, "me"),
        opportunity: {
          title: opp.title,
          organization: opp.organization,
          type: opp.type,
          location: opp.location,
          remote: opp.remote,
          durationMonths: opp.durationMonths,
          deadline: opp.deadline?.toISOString().slice(0, 10) ?? null,
          frenchRequired: opp.frenchRequired,
          fields: opp.fields.map((f) => getField(f).label),
          tags: opp.tags,
          eligibility: opp.eligibility,
          summary: opp.summary,
        },
      }),
      schema: llmCoachSchema,
      maxOutputTokens: 1200,
    });
    const coach: CoachAdvice = { ...out, createdAt: new Date().toISOString() };
    await matches.updateOne({ _id: oid }, { $set: { coach } });
    return json({ coach });
  } catch (err) {
    if (err instanceof LlmUnavailableError) throw new ApiError(503, "Advice isn't available right now. Try again later.");
    throw err;
  }
});
