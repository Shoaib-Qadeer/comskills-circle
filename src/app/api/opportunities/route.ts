import type { Filter } from "mongodb";
import { requireUser, ApiError, ACTIVE_MEMBER } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { publishSchema } from "@/lib/schemas";
import { normalizeUrl } from "@/lib/url";
import { onlyValidFields } from "@/lib/taxonomy";
import { matchOpportunity } from "@/lib/matching";
import { rateLimit } from "@/lib/ratelimit";
import { loadMiniUsers, opportunityDTO } from "@/lib/serialize";
import { urgencyRank } from "@/lib/warnings";
import type { OpportunityDoc } from "@/lib/types";

export const maxDuration = 60;

const dateOrNull = (s: string | null) => (s ? new Date(`${s.slice(0, 10)}T00:00:00Z`) : null);

export const GET = route(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const status = url.searchParams.get("status") === "archive" ? "archive" : "open";
  const field = url.searchParams.get("field");
  const type = url.searchParams.get("type");
  const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
  const sort = url.searchParams.get("sort") === "deadline" ? "deadline" : "new";
  const closingSoon = url.searchParams.get("closingSoon") === "1";

  const todayUtc = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const filter: Filter<OpportunityDoc> =
    status === "open"
      ? { $or: [{ deadline: null }, { deadline: { $gte: todayUtc } }] }
      : { deadline: { $lt: todayUtc } };
  if (field) filter.fields = field;
  if (type) filter.type = type as OpportunityDoc["type"];
  if (closingSoon) filter.deadline = { $gte: todayUtc, $lte: new Date(todayUtc.getTime() + 14 * 86400_000) };
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$and = [{ $or: [{ title: re }, { organization: re }, { location: re }, { tags: re }, { summary: re }] }];
  }

  const { opportunities } = await collections();
  const docs = await opportunities.find(filter).sort({ createdAt: -1 }).limit(300).toArray();
  if (sort === "deadline") docs.sort((a, b) => urgencyRank(a.deadline) - urgencyRank(b.deadline));
  const posters = await loadMiniUsers(docs.map((d) => d.postedBy));
  return json({ items: docs.map((d) => opportunityDTO(d, user, posters)) });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson(req, publishSchema);
  await rateLimit("post", String(user._id), { exempt: user.isAdmin });
  const urlKey = normalizeUrl(body.url);
  if (!urlKey) throw new ApiError(400, "Please provide a valid link.");

  const { opportunities, users } = await collections();
  const dup = await opportunities.findOne({ urlKey }, { projection: { _id: 1 } });
  if (dup) throw new ApiError(409, "This opportunity was already shared.", { opportunityId: String(dup._id) });

  // Only classmates who are visible (class/open) can be tagged
  const tagIds = body.taggedFor.map(toObjectId).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const taggable = tagIds.length
    ? await users
        .find({ _id: { $in: tagIds, $ne: user._id }, ...ACTIVE_MEMBER, visibility: { $in: ["class", "open"] } }, { projection: { _id: 1 } })
        .toArray()
    : [];

  const now = new Date();
  const doc: Omit<OpportunityDoc, "_id"> = {
    url: body.url,
    urlKey,
    postedBy: user._id,
    title: body.title,
    organization: body.organization || null,
    location: body.location || null,
    remote: body.remote,
    type: body.type,
    deadline: dateOrNull(body.deadline),
    startDate: dateOrNull(body.startDate),
    durationMonths: body.durationMonths,
    paid: body.paid,
    frenchRequired: body.frenchRequired,
    fields: onlyValidFields(body.fields),
    tags: body.tags,
    eligibility: body.eligibility || null,
    summary: body.summary,
    taggedFor: taggable.map((t) => t._id),
    posterNote: body.posterNote || null,
    matchCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  let insertedId;
  try {
    insertedId = (await opportunities.insertOne(doc as OpportunityDoc)).insertedId;
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw new ApiError(409, "This opportunity was already shared.");
    throw e;
  }
  const firstPost = !user.hasPosted;
  if (firstPost) await users.updateOne({ _id: user._id }, { $set: { hasPosted: true } });

  const matchCount = await matchOpportunity(insertedId);
  return json({ id: String(insertedId), matchCount, firstPost }, { status: 201 });
});
