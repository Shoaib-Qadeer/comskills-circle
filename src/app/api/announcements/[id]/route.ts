import { requireUser, ApiError } from "@/lib/auth";
import { route, readJson, json, type IdCtx } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { announcementPatchSchema, pinnedUntilDate } from "@/lib/news";

async function loadEditable(ctx: IdCtx) {
  const user = await requireUser();
  const { id } = await ctx.params;
  const oid = toObjectId(id);
  if (!oid) throw new ApiError(404, "Post not found.");
  const { announcements } = await collections();
  const a = await announcements.findOne({ _id: oid });
  if (!a) throw new ApiError(404, "Post not found.");
  // Authors and admins can edit or delete
  if (!user.isAdmin && String(a.authorId) !== String(user._id)) throw new ApiError(403, "Only the author or an admin can change this post.");
  return { user, a };
}

export const PATCH = route(async (req, ctx: IdCtx) => {
  const { a } = await loadEditable(ctx);
  const patch = await readJson(req, announcementPatchSchema);
  const set: Record<string, unknown> = { ...patch };
  if ("pinnedUntil" in patch) set.pinnedUntil = pinnedUntilDate(patch.pinnedUntil ?? null);
  if (patch.pinned === false) set.pinnedUntil = null;
  // Only real content edits show "edited"; pinning doesn't
  if (patch.title !== undefined || patch.body !== undefined || patch.link !== undefined || patch.category !== undefined) set.editedAt = new Date();
  const { announcements } = await collections();
  await announcements.updateOne({ _id: a._id }, { $set: set });
  return json({ ok: true });
});

export const DELETE = route(async (_req, ctx: IdCtx) => {
  const { a } = await loadEditable(ctx);
  const { announcements, reactions, scholarships } = await collections();
  await Promise.all([
    announcements.deleteOne({ _id: a._id }),
    reactions.deleteMany({ announcementId: a._id }),
    // A deleted win announcement can be written again
    a.scholarshipId ? scholarships.updateOne({ _id: a.scholarshipId }, { $set: { announcedAt: null } }) : Promise.resolve(),
  ]);
  return json({ ok: true });
});
