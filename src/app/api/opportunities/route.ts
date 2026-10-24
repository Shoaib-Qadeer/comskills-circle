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
import type { OpportunityDoc, UserDoc } from "@/lib/types";
import { dateOrNull, statusFilter, todayStored, trackedMap } from "@/lib/opportunities";
import { notify } from "@/lib/notify";

export const maxDuration = 60;


export const GET = route(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const status = url.searchParams.get("status") === "archive" ? "archive" : "open";
  const field = url.searchParams.get("field");
  const type = url.searchParams.get("type");
  const country = (url.searchParams.get("country") || "").trim().slice(0, 80);
  const degree = url.searchParams.get("degree");
  const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
  const sort = url.searchParams.get("sort") === "deadline" ? "deadline" : "new";
  const closingSoon = url.searchParams.get("closingSoon") === "1";
  const mine = url.searchParams.get("mine") === "1";

  const today = todayStored();
  const filter: Filter<OpportunityDoc> = statusFilter(status);
  const and: Filter<OpportunityDoc>[] = [];
  if (field) filter.fields = field;
  if (type) filter.type = type as OpportunityDoc["type"];
  if (country) filter.country = new RegExp(`^${escapeRe(country)}$`, "i") as never;
  if (degree) and.push({ degreeLevel: { $in: [degree as OpportunityDoc["degreeLevel"][number], "any"] } });
  if (mine) filter.postedBy = user._id;
  if (closingSoon) filter.deadline = { $gte: today, $lte: new Date(today.getTime() + 14 * 86400_000) };
  if (q) {
    const re = new RegExp(escapeRe(q), "i");
    and.push({ $or: [{ title: re }, { organization: re }, { location: re }, { country: re }, { tags: re }, { summary: re }] });
  }
  if (and.length) filter.$and = and;

  const { opportunities } = await collections();
  const docs = await opportunities.find(filter).sort({ createdAt: -1 }).limit(300).toArray();
  if (sort === "deadline") docs.sort((a, b) => urgencyRank(a.deadline) - urgencyRank(b.deadline));
  const [posters, tracked] = await Promise.all([loadMiniUsers(docs.map((d) => d.postedBy)), trackedMap(user._id, docs.map((d) => d._id))]);
  // Filter chips only show values in use (from all open items, not just this filtered page)
  const facets = await opportunities
    .aggregate<{ _id: null; types: string[]; fields: string[][]; countries: (string | null)[] }>([
      { $match: statusFilter(status) },
      { $group: { _id: null, types: { $addToSet: "$type" }, fields: { $addToSet: "$fields" }, countries: { $addToSet: "$country" } } },
    ])
    .toArray();
  const f = facets[0];
  return json({
    items: docs.map((d) => ({ ...opportunityDTO(d, user, posters), trackedId: tracked.get(String(d._id)) ?? null })),
    facets: {
      types: f?.types ?? [],
      fields: Array.from(new Set((f?.fields ?? []).flat())),
      countries: Array.from(new Set((f?.countries ?? []).filter((c): c is string => Boolean(c)))).sort(),
    },
  });
});

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson(req, publishSchema);
  await rateLimit("post", String(user._id), { exempt: user.isAdmin });
  const urlKey = normalizeUrl(body.url);
  if (!urlKey) throw new ApiError(400, "Please provide a valid link.");

  const { opportunities, users } = await collections();
  const dup = await opportunities.findOne({ urlKey }, { projection: { _id: 1 } });
  if (dup) throw new ApiError(409, "This opportunity was already shared.", { opportunityId: String(dup._id) });

  // Only active members can be tagged (not yourself)
  const tagIds = body.taggedFor.map(toObjectId).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const taggable = tagIds.length
    ? await users.find({ _id: { $in: tagIds, $ne: user._id }, ...ACTIVE_MEMBER } as Filter<UserDoc>, { projection: { _id: 1 } }).toArray()
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
    country: body.country || null,
    degreeLevel: body.degreeLevel,
    funding: body.funding,
    deadline: dateOrNull(body.deadline),
    startDate: dateOrNull(body.startDate),
    durationMonths: body.durationMonths,
    paid: body.paid,
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
  if (taggable.length) {
    await notify(
      taggable.map((t) => t._id),
      { kind: "system", text: `${user.name} thinks you'd like “${doc.title}”`, href: "/for-you?kind=opportunity" },
    );
  }

  const matchCount = await matchOpportunity(insertedId);
  return json({ id: String(insertedId), matchCount, firstPost }, { status: 201 });
});
