import type { AnyBulkWriteOperation, Filter } from "mongodb";
import { collections, ObjectId } from "./db";
import { generateJSON, LlmUnavailableError } from "./llm";
import { systemPrompt } from "./prompts";
import { getSettings, type AiFeature, type PromptKey } from "./settings";
import { ACTIVE_MEMBER } from "./access";
import { llmScoresSchema } from "./schemas";
import { fallbackScore, type ItemLike } from "./fallback-match";
import { getField } from "./taxonomy";
import { scrubForLlm } from "./pii";
import { localDayKey } from "./time";
import type { MatchDoc, MatchKind, OpportunityDoc, ProposalDoc, UserDoc } from "./types";

export type Scored = { score: number; reason: string; basic: boolean };

/* ------------------------------------------------------------------ what the AI sees */

/** Only what the matcher needs — never names, emails, phone numbers, universities or links. */
export function profileForLlm(u: UserDoc, id: string) {
  const who = { name: u.name, email: u.email, university: u.university };
  return {
    id,
    fieldOfStudy: scrubForLlm(u.fieldOfStudy ?? "", who),
    skills: u.skills ?? [],
    tools: u.tools ?? [],
    experience: scrubForLlm((u.experience ?? "").slice(0, 600), who),
    lookingFor: u.lookingFor ?? [],
    lookingForNote: scrubForLlm((u.lookingForNote ?? "").slice(0, 300), who),
    fields: (u.fields ?? []).map((f) => getField(f).label),
    otherInterests: u.freeTags ?? [],
    openToVolunteer: Boolean(u.volunteering?.open),
  };
}

export function oppForLlm(o: OpportunityDoc, id?: string) {
  return {
    ...(id ? { id, kind: "opportunity" } : {}),
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

export function proposalForLlm(p: ProposalDoc, id?: string) {
  return {
    ...(id ? { id, kind: "project" } : {}),
    title: scrubForLlm(p.title),
    problem: scrubForLlm(p.problem),
    idea: scrubForLlm(p.idea.slice(0, 700)),
    skillsNeeded: p.peopleNeeded.skills,
    peopleNeeded: p.peopleNeeded.count,
    commitment: p.commitment,
    fields: p.fields.map((f) => getField(f).label),
    tags: p.tags,
  };
}

export function oppAsItem(o: OpportunityDoc): ItemLike {
  return { kind: "opportunity", fields: o.fields, tags: o.tags, title: o.title, summary: o.summary, type: o.type };
}
export function proposalAsItem(p: ProposalDoc): ItemLike {
  return { kind: "proposal", fields: p.fields, tags: p.tags, skills: p.peopleNeeded.skills, title: p.title, summary: `${p.problem} ${p.idea}` };
}

/* ------------------------------------------------------------------ chunked scoring (pure, testable) */

export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/**
 * Scores `items` with the AI in chunks of `chunkSize`, at most `parallel` calls at a time, stopping
 * before `deadline`. Each chunk gets aliases a1…aN so no ids reach the model. Anything the AI
 * didn't score (call failed, budget reached, out of time) gets the rule-based fallback.
 */
export async function scoreInChunks<T>(opts: {
  items: T[];
  key: (t: T) => string;
  chunkSize: number;
  parallel: number;
  deadline: number;
  aliasPrefix: string;
  call: (batch: { alias: string; item: T }[]) => Promise<{ id: string; score: number; reason: string }[]>;
  fallback: (t: T) => { score: number; reason: string };
  now?: () => number;
}): Promise<{ scores: Map<string, Scored>; calls: number; aiScored: number }> {
  const now = opts.now ?? Date.now;
  const scores = new Map<string, Scored>();
  let calls = 0;
  let stop = false;
  const chunks = chunk(opts.items, Math.max(1, opts.chunkSize));
  for (const wave of chunk(chunks, Math.max(1, opts.parallel))) {
    if (stop || now() >= opts.deadline) break;
    await Promise.all(
      wave.map(async (c) => {
        const aliased = c.map((item, i) => ({ alias: `${opts.aliasPrefix}${i + 1}`, item }));
        const byAlias = new Map(aliased.map((a) => [a.alias, a.item]));
        calls++;
        try {
          const results = await opts.call(aliased);
          for (const r of results) {
            const item = byAlias.get(r.id);
            if (item) scores.set(opts.key(item), { score: Math.max(0, Math.min(100, Math.round(r.score))), reason: r.reason, basic: false });
          }
        } catch (err) {
          // Budget reached or AI off: no point trying more chunks now
          if (err instanceof LlmUnavailableError && /limit|budget|switched off|not configured/i.test(err.message)) stop = true;
          else if (!(err instanceof LlmUnavailableError)) console.error("[match chunk]", err);
        }
      }),
    );
  }
  const aiScored = scores.size;
  for (const item of opts.items) if (!scores.has(opts.key(item))) scores.set(opts.key(item), { ...opts.fallback(item), basic: true });
  return { scores, calls, aiScored };
}

/* ------------------------------------------------------------------ writes */

function upsertOp(
  userId: ObjectId,
  kind: MatchKind,
  targetId: ObjectId,
  s: Scored,
  special?: { source: "tagged" | "invited"; by: ObjectId | null; note: string | null },
): AnyBulkWriteOperation<MatchDoc> {
  return {
    updateOne: {
      filter: { userId, kind, targetId },
      update: {
        $set: {
          score: s.score,
          reason: s.reason,
          basic: s.basic,
          ...(special ? { source: special.source, taggedBy: special.by, taggedNote: special.note } : {}),
        },
        $setOnInsert: {
          ...(special ? {} : { source: "auto" as const, taggedBy: null, taggedNote: null }),
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

async function refreshMatchCounts(kind: MatchKind, ids: ObjectId[]) {
  if (!ids.length) return;
  const { matches, opportunities, proposals } = await collections();
  const counts = await matches
    .aggregate<{ _id: ObjectId; n: number }>([{ $match: { kind, targetId: { $in: ids } } }, { $group: { _id: "$targetId", n: { $sum: 1 } } }])
    .toArray();
  const byId = new Map(counts.map((c) => [String(c._id), c.n]));
  const ops = ids.map((id) => ({ updateOne: { filter: { _id: id }, update: { $set: { matchCount: byId.get(String(id)) ?? 0 } } } }));
  if (kind === "opportunity") await opportunities.bulkWrite(ops);
  else await proposals.bulkWrite(ops);
}

/** Vercel Hobby functions stop at 60 s; leave room for the writes. */
const TIME_BUDGET_MS = 45_000;

async function scoreTargetAgainstMembers(opts: {
  feature: AiFeature;
  prompt: PromptKey;
  label: string;
  target: object;
  item: ItemLike;
  members: UserDoc[];
  startedAt: number;
}) {
  const settings = await getSettings();
  const system = await systemPrompt(opts.prompt);
  return scoreInChunks({
    items: opts.members,
    key: (u) => String(u._id),
    chunkSize: settings.ai.matchChunkSize,
    parallel: 2,
    deadline: opts.startedAt + TIME_BUDGET_MS,
    aliasPrefix: "u",
    call: async (batch) =>
      (
        await generateJSON({
          feature: opts.feature,
          label: opts.label,
          system,
          user: JSON.stringify({ [opts.item.kind === "proposal" ? "project" : "opportunity"]: opts.target, profiles: batch.map((b) => profileForLlm(b.item, b.alias)) }),
          schema: llmScoresSchema,
          maxOutputTokens: 120 + batch.length * 60,
        })
      ).results,
    fallback: (u) => fallbackScore(u, opts.item),
  });
}

/* ------------------------------------------------------------------ opportunity → members */

/** Scores one opportunity against every member and stores matches ≥ threshold (+ everyone tagged). */
export async function matchOpportunity(opportunityId: ObjectId): Promise<number> {
  const startedAt = Date.now();
  const { users, opportunities, matches } = await collections();
  const opp = await opportunities.findOne({ _id: opportunityId });
  if (!opp) return 0;
  const settings = await getSettings();
  const candidates = await users.find({ ...ACTIVE_MEMBER, ...(opp.postedBy ? { _id: { $ne: opp.postedBy } } : {}) }).toArray();
  const { scores } = await scoreTargetAgainstMembers({
    feature: "matchOpportunity",
    prompt: "matchOpportunity",
    label: "match-opportunity",
    target: oppForLlm(opp),
    item: oppAsItem(opp),
    members: candidates,
    startedAt,
  });
  const ops: AnyBulkWriteOperation<MatchDoc>[] = [];
  const below: ObjectId[] = [];
  for (const u of candidates) {
    const s = scores.get(String(u._id))!;
    if (s.score >= settings.ai.matchThreshold) ops.push(upsertOp(u._id, "opportunity", opp._id, s));
    else below.push(u._id);
  }
  // Tagged members always get it, even below the threshold
  for (const tid of opp.taggedFor) {
    if (opp.postedBy && String(tid) === String(opp.postedBy)) continue;
    const s = scores.get(String(tid)) ?? { score: 0, reason: "", basic: true };
    ops.push(upsertOp(tid, "opportunity", opp._id, s, { source: "tagged", by: opp.postedBy, note: opp.posterNote }));
  }
  if (ops.length) await matches.bulkWrite(ops, { ordered: true });
  if (below.length) await matches.deleteMany({ kind: "opportunity", targetId: opp._id, userId: { $in: below }, source: "auto", saved: false });
  await refreshMatchCounts("opportunity", [opp._id]);
  return (await opportunities.findOne({ _id: opp._id }, { projection: { matchCount: 1 } }))?.matchCount ?? 0;
}

/* ------------------------------------------------------------------ proposal → members */

/** Who can still be matched to a proposal: active members who aren't the proposer or already on the team. */
async function proposalCandidates(p: ProposalDoc): Promise<UserDoc[]> {
  const { users, proposalMembers } = await collections();
  const taken = await proposalMembers.find({ proposalId: p._id, status: { $in: ["accepted", "removed", "declined"] } }, { projection: { userId: 1 } }).toArray();
  const exclude = [...taken.map((t) => t.userId), ...(p.proposedBy ? [p.proposedBy] : [])];
  return users.find({ ...ACTIVE_MEMBER, _id: { $nin: exclude } } as Filter<UserDoc>).toArray();
}

/** Scores one project proposal against every eligible member; keeps matches ≥ threshold and invites. */
export async function matchProposal(proposalId: ObjectId): Promise<number> {
  const startedAt = Date.now();
  const { proposals, matches } = await collections();
  const p = await proposals.findOne({ _id: proposalId });
  if (!p) return 0;
  const settings = await getSettings();
  const candidates = await proposalCandidates(p);
  const { scores } = await scoreTargetAgainstMembers({
    feature: "matchProposal",
    prompt: "matchProposal",
    label: "match-proposal",
    target: proposalForLlm(p),
    item: proposalAsItem(p),
    members: candidates,
    startedAt,
  });
  const ops: AnyBulkWriteOperation<MatchDoc>[] = [];
  const below: ObjectId[] = [];
  for (const u of candidates) {
    const s = scores.get(String(u._id))!;
    if (s.score >= settings.ai.matchThreshold) ops.push(upsertOp(u._id, "proposal", p._id, s));
    else below.push(u._id);
  }
  if (ops.length) await matches.bulkWrite(ops, { ordered: false });
  if (below.length) await matches.deleteMany({ kind: "proposal", targetId: p._id, userId: { $in: below }, source: "auto", saved: false });
  await refreshMatchCounts("proposal", [p._id]);
  return (await proposals.findOne({ _id: p._id }, { projection: { matchCount: 1 } }))?.matchCount ?? 0;
}

/* ------------------------------------------------------------------ one member → everything open */

/** Re-scores one member against open opportunities AND open proposals (after onboarding or an edit). */
export async function matchProfile(userId: ObjectId): Promise<number> {
  const startedAt = Date.now();
  const { users, opportunities, proposals, proposalMembers, matches } = await collections();
  const user = await users.findOne({ _id: userId });
  if (!user || !user.onboarded || user.status !== "approved") return 0;
  const settings = await getSettings();
  const todayKey = localDayKey();
  const todayUtc = new Date(`${todayKey}T00:00:00Z`);

  const [opps, mine] = await Promise.all([
    opportunities
      .find({ postedBy: { $ne: userId }, $or: [{ deadline: null }, { deadline: { $gte: todayUtc } }] })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray(),
    proposalMembers.find({ userId, status: { $in: ["accepted", "removed", "declined"] } }, { projection: { proposalId: 1 } }).toArray(),
  ]);
  const props = await proposals
    .find({ proposedBy: { $ne: userId }, status: { $in: ["open", "team_forming"] }, acceptingMembers: true, _id: { $nin: mine.map((m) => m.proposalId) } })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  const profile = profileForLlm(user, "me");
  const system = await systemPrompt("matchProfile");
  type Item = { kind: MatchKind; doc: OpportunityDoc | ProposalDoc };
  const items: Item[] = [...props.map((d) => ({ kind: "proposal" as const, doc: d })), ...opps.map((d) => ({ kind: "opportunity" as const, doc: d }))];
  const asItem = (i: Item) => (i.kind === "proposal" ? proposalAsItem(i.doc as ProposalDoc) : oppAsItem(i.doc as OpportunityDoc));

  // Projects and opportunities have their own AI switches, so they are scored in separate passes.
  const results = new Map<string, Scored>();
  for (const kind of ["proposal", "opportunity"] as const) {
    const group = items.filter((i) => i.kind === kind);
    if (!group.length) continue;
    const { scores } = await scoreInChunks({
      items: group,
      key: (i) => `${i.kind}:${String(i.doc._id)}`,
      chunkSize: settings.ai.profileBatchSize,
      parallel: 2,
      deadline: startedAt + TIME_BUDGET_MS,
      aliasPrefix: kind === "proposal" ? "p" : "o",
      call: async (batch) =>
        (
          await generateJSON({
            feature: kind === "proposal" ? "matchProposal" : "matchOpportunity",
            label: "match-profile",
            system,
            user: JSON.stringify({
              profile,
              items: batch.map((b) => (b.item.kind === "proposal" ? proposalForLlm(b.item.doc as ProposalDoc, b.alias) : oppForLlm(b.item.doc as OpportunityDoc, b.alias))),
            }),
            schema: llmScoresSchema,
            maxOutputTokens: 120 + batch.length * 60,
          })
        ).results,
      fallback: (i) => fallbackScore(user, asItem(i)),
    });
    scores.forEach((v, k) => results.set(k, v));
  }

  const ops: AnyBulkWriteOperation<MatchDoc>[] = [];
  const below: { kind: MatchKind; id: ObjectId }[] = [];
  for (const i of items) {
    const s = results.get(`${i.kind}:${String(i.doc._id)}`)!;
    if (s.score >= settings.ai.matchThreshold) ops.push(upsertOp(user._id, i.kind, i.doc._id, s));
    else below.push({ kind: i.kind, id: i.doc._id });
  }
  if (ops.length) await matches.bulkWrite(ops, { ordered: false });
  // Remove auto matches that no longer fit — never tagged, invited or saved ones
  for (const kind of ["opportunity", "proposal"] as const) {
    const ids = below.filter((b) => b.kind === kind).map((b) => b.id);
    if (ids.length) await matches.deleteMany({ userId: user._id, kind, targetId: { $in: ids }, source: "auto", saved: false });
  }
  await refreshMatchCounts("opportunity", opps.map((o) => o._id));
  await refreshMatchCounts("proposal", props.map((p) => p._id));
  return matches.countDocuments({ userId: user._id, dismissed: false });
}
