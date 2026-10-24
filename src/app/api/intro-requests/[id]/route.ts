import { requireUser, ApiError } from "@/lib/auth";
import { route, readJson, json, type IdCtx } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { introPatchSchema } from "@/lib/schemas";

/** Only the owner of the connection can accept / decline / mark done. */
export const PATCH = route(async (req, ctx: IdCtx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const oid = toObjectId(id);
  if (!oid) throw new ApiError(404, "Not found");
  const { status } = await readJson(req, introPatchSchema);
  const { introRequests } = await collections();
  const res = await introRequests.updateOne({ _id: oid, addedBy: user._id }, { $set: { status, updatedAt: new Date() } });
  if (!res.matchedCount) throw new ApiError(404, "Not found");
  return json({ ok: true });
});

/** The requester can withdraw a request. */
export const DELETE = route(async (_req, ctx: IdCtx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const oid = toObjectId(id);
  if (!oid) throw new ApiError(404, "Not found");
  const { introRequests } = await collections();
  await introRequests.deleteOne({ _id: oid, requesterId: user._id });
  return json({ ok: true });
});
