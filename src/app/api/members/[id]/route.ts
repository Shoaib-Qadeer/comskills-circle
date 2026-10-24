import { requireUser, ApiError, ACTIVE_MEMBER } from "@/lib/auth";
import { route, json, type IdCtx } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { memberProfileDTO } from "@/lib/serialize";
import { connectStateBetween } from "@/lib/connect";
import { getSettings } from "@/lib/settings";

/** One member's full profile. Contacts are added only when the privacy rule allows it. */
export const GET = route(async (_req, ctx: IdCtx) => {
  const viewer = await requireUser();
  const { id } = await ctx.params;
  const oid = toObjectId(id);
  if (!oid) throw new ApiError(404, "Member not found.");
  const { users } = await collections();
  const u = await users.findOne({ _id: oid, ...ACTIVE_MEMBER });
  if (!u) throw new ApiError(404, "Member not found.");
  const [connect, settings] = await Promise.all([connectStateBetween(viewer._id, u._id), getSettings()]);
  return json(memberProfileDTO(u, viewer, { connect, settings }));
});
