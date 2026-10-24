import { requireUser, ApiError } from "@/lib/auth";
import { route, readJson, json, type IdCtx } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { matchPatchSchema } from "@/lib/schemas";

export const PATCH = route(async (req, ctx: IdCtx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const oid = toObjectId(id);
  if (!oid) throw new ApiError(404, "Not found");
  const patch = await readJson(req, matchPatchSchema);
  const { matches } = await collections();
  const res = await matches.updateOne({ _id: oid, userId: user._id }, { $set: patch });
  if (!res.matchedCount) throw new ApiError(404, "Not found");
  return json({ ok: true });
});
