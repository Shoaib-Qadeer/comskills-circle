import { z } from "zod";
import { requireAdmin, ApiError } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { activeModel, llmKeyConfigured, llmProvider, llmUsage } from "@/lib/llm";
import { matchOpportunity, matchProfile } from "@/lib/matching";
import { getSettings } from "@/lib/settings";

export const maxDuration = 60;

/** Overview numbers for the dashboard. */
export const GET = route(async () => {
  await requireAdmin();
  const c = await collections();
  const todayUtc = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const [users, pending, onboarded, active7, open, archived, matches, usage, settings] = await Promise.all([
    c.users.countDocuments({}),
    c.users.countDocuments({ status: "pending" }),
    c.users.countDocuments({ onboarded: true, status: { $nin: ["pending", "rejected"] } }),
    c.users.countDocuments({ lastSeenAt: { $gte: weekAgo } }),
    c.opportunities.countDocuments({ $or: [{ deadline: null }, { deadline: { $gte: todayUtc } }] }),
    c.opportunities.countDocuments({ deadline: { $lt: todayUtc } }),
    c.matches.countDocuments({}),
    llmUsage(14),
    getSettings(),
  ]);
  return json({
    counts: { users, pending, onboarded, active7, open, archived, matches },
    ai: {
      provider: llmProvider(),
      model: await activeModel(),
      keyConfigured: llmKeyConfigured(),
      enabled: settings.ai.enabled,
      dailyCallLimit: settings.ai.dailyCallLimit,
      dailyTokenLimit: settings.ai.dailyTokenLimit,
      usage,
    },
  });
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rematch"), opportunityId: z.string() }),
  z.object({ action: z.literal("rematchUser"), userId: z.string() }),
]);

export const POST = route(async (req) => {
  await requireAdmin();
  const body = await readJson(req, actionSchema);
  if (body.action === "rematch") {
    const oid = toObjectId(body.opportunityId);
    if (!oid) throw new ApiError(404, "Not found");
    return json({ matchCount: await matchOpportunity(oid) });
  }
  const uid = toObjectId(body.userId);
  if (!uid) throw new ApiError(404, "Not found");
  return json({ matchCount: await matchProfile(uid) });
});
