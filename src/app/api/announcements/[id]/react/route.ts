import { z } from "zod";
import { requireUser, ApiError } from "@/lib/auth";
import { route, readJson, json, type IdCtx } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { limitWindow } from "@/lib/ratelimit";
import { REACTIONS } from "@/lib/types";

const schema = z.object({ emoji: z.enum(REACTIONS) });

/** Toggles one reaction (one of each emoji per member). Counts live on the post. */
export const POST = route(async (req, ctx: IdCtx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const oid = toObjectId(id);
  if (!oid) throw new ApiError(404, "Post not found.");
  const { emoji } = await readJson(req, schema);
  await limitWindow("react", String(user._id), 120, "hour", "Slow down a little and try again.");
  const { announcements, reactions } = await collections();
  if (!(await announcements.findOne({ _id: oid }, { projection: { _id: 1 } }))) throw new ApiError(404, "Post not found.");
  let on: boolean;
  try {
    await reactions.insertOne({ announcementId: oid, userId: user._id, emoji, createdAt: new Date() } as never);
    on = true;
  } catch (e) {
    if ((e as { code?: number }).code !== 11000) throw e;
    await reactions.deleteOne({ announcementId: oid, userId: user._id, emoji });
    on = false;
  }
  const a = await announcements.findOneAndUpdate({ _id: oid }, { $inc: { [`reactionCounts.${emoji}`]: on ? 1 : -1 } }, { returnDocument: "after" });
  return json({ on, count: Math.max(0, a?.reactionCounts?.[emoji] ?? 0) });
});
