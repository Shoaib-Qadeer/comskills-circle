import { requireUser, ApiError } from "@/lib/auth";
import { route, readJson, json, type IdCtx } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { moveProblem, scholarshipDTO, scholarshipPatchSchema, toStoredFields } from "@/lib/scholarships";

async function loadOwn(ctx: IdCtx, userId: unknown, isAdmin: boolean) {
  const { id } = await ctx.params;
  const oid = toObjectId(id);
  if (!oid) throw new ApiError(404, "Entry not found.");
  const { scholarships } = await collections();
  const s = await scholarships.findOne({ _id: oid });
  // Someone else's entry looks the same as a missing one
  if (!s || (String(s.userId) !== String(userId) && !isAdmin)) throw new ApiError(404, "Entry not found.");
  return s;
}

/** Edit an entry or move it to another stage (with that stage's details). Keeps a history of moves. */
export const PATCH = route(async (req, ctx: IdCtx) => {
  const user = await requireUser();
  const s = await loadOwn(ctx, user._id, false);
  const patch = await readJson(req, scholarshipPatchSchema);
  const moving = patch.stage && patch.stage !== s.stage;
  if (moving) {
    const problem = moveProblem(s, patch.stage!, patch);
    if (problem) throw new ApiError(400, problem);
  }
  const now = new Date();
  const set = { ...toStoredFields(patch), updatedAt: now };
  // Moving out of Accepted and back clears the "announced" mark only if it was never announced
  const { scholarships } = await collections();
  await scholarships.updateOne({ _id: s._id }, { $set: set, ...(moving ? { $push: { history: { stage: patch.stage!, at: now } } } : {}) });
  const fresh = await scholarships.findOne({ _id: s._id });
  return json(scholarshipDTO(fresh!, user._id));
});

export const DELETE = route(async (_req, ctx: IdCtx) => {
  const user = await requireUser();
  const s = await loadOwn(ctx, user._id, user.isAdmin);
  const { scholarships } = await collections();
  await scholarships.deleteOne({ _id: s._id });
  return json({ ok: true });
});
