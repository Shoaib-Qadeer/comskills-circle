import { requireUser } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { collections } from "@/lib/db";
import { notifySchema } from "@/lib/schemas";

/** Email preferences: digest frequency and which instant emails to get. */
export const PUT = route(async (req) => {
  const user = await requireUser({ onboarded: false });
  const notify = await readJson(req, notifySchema);
  const { users } = await collections();
  await users.updateOne({ _id: user._id }, { $set: { notify, updatedAt: new Date() } });
  return json({ notify });
});
