import { z } from "zod";
import { requireUser, ApiError } from "@/lib/auth";
import { route, readJson, json, type IdCtx } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { notify } from "@/lib/notify";
import { firstName } from "@/lib/client-safe";

const patchSchema = z.object({ status: z.enum(["accepted", "declined"]) });

/** Only the person who received the request can accept or decline it. */
export const PATCH = route(async (req, ctx: IdCtx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const oid = toObjectId(id);
  if (!oid) throw new ApiError(404, "Request not found.");
  const { status } = await readJson(req, patchSchema);
  const { connectRequests } = await collections();
  const r = await connectRequests.findOneAndUpdate({ _id: oid, to: user._id, status: "pending" }, { $set: { status, decidedAt: new Date() } }, { returnDocument: "after" });
  if (!r) throw new ApiError(404, "This request was already answered or withdrawn.");
  if (status === "accepted") {
    await notify([r.from], {
      kind: "connectAccepted",
      text: `${user.name} accepted your connect request. You can now see each other's contacts.`,
      href: `/members/${String(user._id)}`,
      email: { subject: `${firstName(user.name)} accepted your connect request`, heading: "You're connected", lines: [`${user.name} accepted. You can now see each other's WhatsApp and email.`], cta: "See their profile" },
    });
  }
  return json({ ok: true, status });
});

/** The sender can withdraw a request that hasn't been answered. */
export const DELETE = route(async (_req, ctx: IdCtx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const oid = toObjectId(id);
  if (!oid) throw new ApiError(404, "Request not found.");
  const { connectRequests } = await collections();
  const res = await connectRequests.deleteOne({ _id: oid, from: user._id, status: "pending" });
  if (!res.deletedCount) throw new ApiError(404, "This request was already answered or withdrawn.");
  return json({ ok: true });
});
