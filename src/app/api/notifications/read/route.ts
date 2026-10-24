import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";

const schema = z.object({ ids: z.array(z.string()).max(200).optional(), all: z.boolean().optional() });

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson(req, schema);
  const { notifications } = await collections();
  const ids = (body.ids ?? []).map(toObjectId).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const filter = body.all ? { userId: user._id, read: false } : { userId: user._id, _id: { $in: ids } };
  const r = await notifications.updateMany(filter, { $set: { read: true } });
  return json({ updated: r.modifiedCount });
});
