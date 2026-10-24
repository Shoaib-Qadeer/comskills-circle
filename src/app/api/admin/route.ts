import { todayStored } from "@/lib/opportunities";
import { z } from "zod";
import { requireAdmin, ApiError } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { activeModel, llmKeyConfigured, llmProvider, llmUsage } from "@/lib/llm";
import { matchOpportunity, matchProfile, matchProposal } from "@/lib/matching";
import { getSettings } from "@/lib/settings";
import { emailUsageToday, mailConfigured } from "@/lib/mail";
import { ACTIVE_MEMBER } from "@/lib/access";
import { BUDGETS } from "@/lib/budgets";

export const maxDuration = 60;

/** Overview numbers for the dashboard. */
export const GET = route(async () => {
  await requireAdmin();
  const c = await collections();
  const todayUtc = todayStored();
  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const countBy = async (coll: "proposals" | "scholarships", field: string) => {
    const rows = await (c[coll] as unknown as import("mongodb").Collection).aggregate<{ _id: string; n: number }>([{ $group: { _id: `$${field}`, n: { $sum: 1 } } }]).toArray();
    return Object.fromEntries(rows.map((r) => [r._id, r.n])) as Record<string, number>;
  };
  const [users, pending, onboarded, active7, team, open, archived, matches, proposalsByStatus, scholarshipsByStage, openReports, announcements, usage, settings, email, dbStats, photos] = await Promise.all([
    c.users.countDocuments({ emailVerifiedAt: { $ne: null } }),
    c.users.countDocuments({ status: "pending", emailVerifiedAt: { $ne: null } }),
    c.users.countDocuments(ACTIVE_MEMBER),
    c.users.countDocuments({ lastSeenAt: { $gte: weekAgo } }),
    c.users.countDocuments({ ...ACTIVE_MEMBER, role: "team" }),
    c.opportunities.countDocuments({ $or: [{ deadline: null }, { deadline: { $gte: todayUtc } }] }),
    c.opportunities.countDocuments({ deadline: { $lt: todayUtc } }),
    c.matches.countDocuments({}),
    countBy("proposals", "status"),
    countBy("scholarships", "stage"),
    c.reports.countDocuments({ resolved: false }),
    c.announcements.countDocuments({}),
    llmUsage(14),
    getSettings(),
    emailUsageToday(),
    c.users.db.stats().catch(() => null),
    c.photos.countDocuments({}),
  ]);
  const dbBytes = dbStats ? Number(dbStats.dataSize ?? 0) + Number(dbStats.indexSize ?? 0) : null;
  return json({
    counts: { users, pending, onboarded, active7, team, open, archived, matches, openReports, announcements, photos },
    proposalsByStatus,
    scholarshipsByStage,
    email: { ...email, configured: mailConfigured() },
    storage: { usedBytes: dbBytes, limitBytes: BUDGETS.atlasBytes },
    budgets: BUDGETS,
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
  z.object({ action: z.literal("rematchProposal"), proposalId: z.string() }),
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
  if (body.action === "rematchProposal") {
    const pid = toObjectId(body.proposalId);
    if (!pid) throw new ApiError(404, "Not found");
    return json({ matchCount: await matchProposal(pid) });
  }
  const uid = toObjectId(body.userId);
  if (!uid) throw new ApiError(404, "Not found");
  return json({ matchCount: await matchProfile(uid) });
});
