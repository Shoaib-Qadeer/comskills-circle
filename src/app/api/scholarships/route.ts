import { requireUser, ApiError } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { scholarshipDTO, scholarshipInputSchema, toStoredFields } from "@/lib/scholarships";
import type { ScholarshipDoc } from "@/lib/types";

/** My tracker: every entry I've added, newest activity first. */
export const GET = route(async () => {
  const user = await requireUser();
  const { scholarships } = await collections();
  const docs = await scholarships.find({ userId: user._id }).sort({ updatedAt: -1 }).limit(500).toArray();
  return json({ items: docs.map((s) => scholarshipDTO(s, user._id)) });
});

/** Add an entry at any stage (e.g. "Track this" on an opportunity creates an Applying entry). */
export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson(req, scholarshipInputSchema);
  await rateLimit("tracker", String(user._id), { exempt: user.isAdmin });
  const { scholarships, opportunities } = await collections();
  let opportunityId = null;
  if (body.opportunityId) {
    opportunityId = toObjectId(body.opportunityId);
    if (!opportunityId || !(await opportunities.findOne({ _id: opportunityId }, { projection: { _id: 1 } }))) throw new ApiError(404, "That opportunity no longer exists.");
    const dup = await scholarships.findOne({ userId: user._id, opportunityId }, { projection: { _id: 1 } });
    if (dup) throw new ApiError(409, "You're already tracking this one.", { scholarshipId: String(dup._id) });
  }
  const now = new Date();
  const doc: Omit<ScholarshipDoc, "_id"> = {
    userId: user._id,
    name: body.name,
    country: body.country,
    link: null,
    opportunityId,
    stage: body.stage,
    deadline: null,
    submittedAt: null,
    expectedResultAt: null,
    rejectedAt: null,
    lesson: null,
    programme: null,
    university: null,
    startDate: null,
    rejectedVisibility: "team",
    announceConsent: false,
    announcedAt: null,
    remindersSent: [],
    history: [{ stage: body.stage, at: now }],
    createdAt: now,
    updatedAt: now,
    ...toStoredFields(body),
  };
  const { insertedId } = await scholarships.insertOne(doc as ScholarshipDoc);
  return json(scholarshipDTO({ ...(doc as ScholarshipDoc), _id: insertedId }, user._id), { status: 201 });
});
