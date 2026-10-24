import { requireTeam, ApiError } from "@/lib/auth";
import { route, json, type IdCtx } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";

/** Details to pre-fill a win announcement (team only, and only for consented, unannounced wins). */
export const GET = route(async (_req, ctx: IdCtx) => {
  await requireTeam();
  const { id } = await ctx.params;
  const oid = toObjectId(id);
  const { scholarships, users } = await collections();
  const s = oid ? await scholarships.findOne({ _id: oid }) : null;
  if (!s || s.stage !== "accepted" || !s.announceConsent) throw new ApiError(404, "That win isn't available to announce.");
  const u = await users.findOne({ _id: s.userId }, { projection: { name: 1 } });
  return json({ id: String(s._id), memberName: u?.name ?? "a Comskills member", programme: s.programme ?? s.name, university: s.university, scholarship: s.name, announced: Boolean(s.announcedAt) });
});
