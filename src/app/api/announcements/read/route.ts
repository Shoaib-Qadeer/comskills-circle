import { requireUser } from "@/lib/auth";
import { route, json } from "@/lib/api";
import { collections } from "@/lib/db";

/** Opening News clears the unread badge. */
export const POST = route(async () => {
  const user = await requireUser();
  const { users } = await collections();
  await users.updateOne({ _id: user._id }, { $set: { "seen.announcementsAt": new Date() } });
  return json({ ok: true });
});
