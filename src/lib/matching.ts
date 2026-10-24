import type { AnyBulkWriteOperation } from "mongodb";
import { collections, ObjectId } from "./db";
import { generateJSON, LlmUnavailableError } from "./llm";
import { systemPrompt } from "./prompts";
import { getSettings } from "./settings";
import { ACTIVE_MEMBER } from "./access";
import { llmScoresSchema } from "./schemas";
import { fallbackScore } from "./fallback-match";
import { getField } from "./taxonomy";
import type { MatchDoc, OpportunityDoc, UserDoc } from "./types";


type Scored = { score: number; reason: string; basic: boolean };

/** Only what the matcher needs — never names or emails. */
function profileForLlm(u: UserDoc, id: string) {
  return {
    id,
    headline: u.headline,
    summary: u.summary.slice(0, 800),
    fields: u.fields.map((f) => getField(f).label),
    otherInterests: u.freeTags,
    targetRoles: u.targetRoles,
    preferredLocations: u.preferredLocations,
  };
}

function oppForLlm(o: OpportunityDoc, id?: string) {
  return {
    ...(id ? { id } : {}),
    title: o.title,
    organization: o.organization,
    type: o.type,
    location: o.location,
    remote: o.remote,
    durationMonths: o.durationMonths,
    fields: o.fields.map((f) => getField(f).label),
    tags: o.tags,
    eligibility: o.eligibility,
    summary: o.summary,
  };
}

/** French-required roles are only auto-matched to people who said they're open to French. */
export function passesHardFilters(u: UserDoc, o: OpportunityDoc): boolean {
  if (o.frenchRequired === true && !u.openToFrench) return false;
  return true;
}

function upsertOps(
  userId: ObjectId,
  opportunityId: ObjectId,
  s: Scored,
  tagged?: { by: ObjectId; note: string | null },
): AnyBulkWriteOperation<MatchDoc> {
  return {
    updateOne: {
      filter: { userId, opportunityId },
      update: {
        $set: {
          score: s.score,
          reason: s.reason,
          basic: s.basic,
          ...(tagged ? { source: "tagged" as const, taggedBy: tagged.by, taggedNote: tagged.note } : {}),
        },
        $setOnInsert: {
          ...(tagged ? {} : { source: "auto" as const, taggedBy: null, taggedNote: null }),
          seen: false,
          saved: false,
          dismissed: false,
          createdAt: new Date(),
        },
      },
      upsert: true,
    },
  };
}

async function refreshMatchCounts(oppIds: ObjectId[]) {
  if (!oppIds.length) return;
  const { matches, opportunities } = await collections();
  const counts = await matches
    .aggregate<{ _id: ObjectId; n: number }>([
      { $match: { opportunityId: { $in: oppIds } } },
      { $group: { _id: "$opportunityId", n: { $sum: 1 } } },
    ])
    .toArray();
  const byId = new Map(counts.map((c) => [String(c._id), c.n]));
  await opportunities.bulkWrite(
    oppIds.map((id) => ({ updateOne: { filter: { _id: id }, update: { $set: { matchCount: byId.get(String(id)) ?? 0 } } } })),
  );
}

/** Scores one opportunity against every eligible classmate and stores matches ≥ threshold (+ all tagged). */
export async function matchOpportunity(opportunityId: ObjectId): Promise<number> {
  const { users, opportunities, matches } = await collections();
  const opp = await opportunities.findOne({ _id: opportunityId });
  if (!opp) return 0;
  const settings = await getSettings();
  const MATCH_THRESHOLD = settings.ai.matchThreshold;
  const candidates = await users
    .find({ ...ACTIVE_MEMBER, ...(opp.postedBy ? { _id: { $ne: opp.postedBy } } : {}) })
    .toArray();
  const eligible = candidates.filter((u) => passesHardFilters(u, opp));
  const scores = new Map<string, Scored>();

  if (eligible.length) {
    const alias = new Map(eligible.map((u, i) => [`u${i + 1}`, u]));
    try {
      const out = await generateJSON({
        feature: "matching",
        label: "match-opportunity",
        system: await systemPrompt("matchOpportunity"),
        user: JSON.stringify({ opportunity: oppForLlm(opp), profiles: Array.from(alias, ([id, u]) => profileForLlm(u, id)) }),
        schema: llmScoresSchema,
        maxOutputTokens: 4000,
      });
      for (const r of out.results) {
        const u = alias.get(r.id);
        if (u) scores.set(String(u._id), { score: Math.round(r.score), reason: r.reason, basic: false });
      }
    } catch (err) {
      if (!(err instanceof LlmUnavailableError)) console.error("[match-opp]", err);
    }
    // Fallback for anyone the LLM didn't score
    for (const u of eligible) {
      if (!scores.has(String(u._id))) scores.set(String(u._id), { ...fallbackScore(u, opp), basic: true });
    }
  }

  const ops: AnyBulkWriteOperation<MatchDoc>[] = [];
  for (const u of eligible) {
    const s = scores.get(String(u._id))!;
    if (s.score >= MATCH_THRESHOLD) ops.push(upsertOps(u._id, opp._id, s));
  }
  // Tagged classmates always get the match, even below threshold or French-filtered
  for (const tid of opp.taggedFor) {
    if (opp.postedBy && String(tid) === String(opp.postedBy)) continue;
    const s = scores.get(String(tid)) ?? { score: 0, reason: "", basic: true };
    ops.push(upsertOps(tid, opp._id, s, { by: opp.postedBy!, note: opp.posterNote }));
  }
  if (ops.length) await matches.bulkWrite(ops, { ordered: true });
  await refreshMatchCounts([opp._id]);
  const fresh = await opportunities.findOne({ _id: opp._id }, { projection: { matchCount: 1 } });
  return fresh?.matchCount ?? 0;
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** Re-scores one classmate against all open opportunities (after onboarding or a profile edit). */
export async function matchProfile(userId: ObjectId): Promise<number> {
  const { users, opportunities, matches } = await collections();
  const user = await users.findOne({ _id: userId });
  if (!user || !user.onboarded || user.status === "pending" || user.status === "rejected") return 0;
  const settings = await getSettings();
  const MATCH_THRESHOLD = settings.ai.matchThreshold;
  const todayUtc = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const opps = await opportunities
    .find({
      postedBy: { $ne: userId },
      $or: [{ deadline: null }, { deadline: { $gte: todayUtc } }],
    })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  const eligible = opps.filter((o) => passesHardFilters(user, o));
  const ineligibleIds = opps.filter((o) => !passesHardFilters(user, o)).map((o) => o._id);
  const scores = new Map<string, Scored>();
  const profile = profileForLlm(user, "me");

  const batches = chunk(eligible, settings.ai.profileBatchSize);
  // Up to 3 LLM calls in parallel to stay well inside serverless time limits
  for (const group of chunk(batches, 3)) {
    await Promise.all(
      group.map(async (batch) => {
        const alias = new Map(batch.map((o, i) => [`o${i + 1}`, o]));
        try {
          const out = await generateJSON({
            feature: "matching",
            label: "match-profile",
            system: await systemPrompt("matchProfile"),
            user: JSON.stringify({ profile, opportunities: Array.from(alias, ([id, o]) => oppForLlm(o, id)) }),
            schema: llmScoresSchema,
            maxOutputTokens: 4000,
          });
          for (const r of out.results) {
            const o = alias.get(r.id);
            if (o) scores.set(String(o._id), { score: Math.round(r.score), reason: r.reason, basic: false });
          }
        } catch (err) {
          if (!(err instanceof LlmUnavailableError)) console.error("[match-profile]", err);
        }
      }),
    );
  }
  for (const o of eligible) {
    if (!scores.has(String(o._id))) scores.set(String(o._id), { ...fallbackScore(user, o), basic: true });
  }

  const ops: AnyBulkWriteOperation<MatchDoc>[] = [];
  const below: ObjectId[] = [...ineligibleIds];
  for (const o of eligible) {
    const s = scores.get(String(o._id))!;
    if (s.score >= MATCH_THRESHOLD) ops.push(upsertOps(user._id, o._id, s));
    else below.push(o._id);
  }
  if (ops.length) await matches.bulkWrite(ops, { ordered: false });
  // Remove auto-matches that no longer fit — never tagged or saved ones
  if (below.length) {
    await matches.deleteMany({ userId: user._id, opportunityId: { $in: below }, source: "auto", saved: false });
  }
  await refreshMatchCounts(opps.map((o) => o._id));
  return matches.countDocuments({ userId: user._id, dismissed: false });
}
