import { requireUser, ApiError } from "@/lib/auth";
import { route, json, type IdCtx } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { scholarshipDTO } from "@/lib/scholarships";
import { TRACKABLE_TYPES } from "@/lib/taxonomy";
import { isHttpUrl } from "@/lib/url";
import type { ScholarshipDoc } from "@/lib/types";

/**
 * "Track this": adds an Applying entry to your scholarship tracker, pre-filled from the post
 * (name, country, deadline, link) and linked to it by opportunityId. One entry per person per post.
 */
export const POST = route(async (_req, ctx: IdCtx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const oid = toObjectId(id);
  const { opportunities, scholarships } = await collections();
  const opp = oid ? await opportunities.findOne({ _id: oid }) : null;
  if (!opp) throw new ApiError(404, "That opportunity no longer exists.");
  if (!TRACKABLE_TYPES.includes(opp.type)) throw new ApiError(400, "Only scholarships and fellowships can be added to the tracker.");
  const dup = await scholarships.findOne({ userId: user._id, opportunityId: opp._id }, { projection: { _id: 1 } });
  if (dup) throw new ApiError(409, "You're already tracking this one.", { scholarshipId: String(dup._id) });
  await rateLimit("tracker", String(user._id), { exempt: user.isAdmin });

  const now = new Date();
  const doc: Omit<ScholarshipDoc, "_id"> = {
    userId: user._id,
    name: opp.title.slice(0, 120),
    country: (opp.country || "Not stated").slice(0, 60),
    link: isHttpUrl(opp.url) ? opp.url : null,
    opportunityId: opp._id,
    stage: "applying",
    deadline: opp.deadline,
    submittedAt: null,
    expectedResultAt: null,
    rejectedAt: null,
    lesson: null,
    programme: null,
    university: opp.organization ? opp.organization.slice(0, 120) : null,
    startDate: opp.startDate,
    rejectedVisibility: "team",
    announceConsent: false,
    announcedAt: null,
    remindersSent: [],
    history: [{ stage: "applying", at: now }],
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await scholarships.insertOne(doc as ScholarshipDoc);
  return json(scholarshipDTO({ ...(doc as ScholarshipDoc), _id: insertedId }, user._id), { status: 201 });
});
