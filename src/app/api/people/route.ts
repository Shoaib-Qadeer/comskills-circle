import { requireUser, ACTIVE_MEMBER } from "@/lib/auth";
import { route, json } from "@/lib/api";
import { collections } from "@/lib/db";
import { personDTO } from "@/lib/serialize";
import type { PersonDTO } from "@/lib/types";

/** Visible classmates only (class/open). Private profiles are counted, never listed. */
export const GET = route(async () => {
  const user = await requireUser();
  const { users } = await collections();
  const all = await users.find(ACTIVE_MEMBER).toArray();
  const people = all
    .map((u) => personDTO(u, user._id))
    .filter((p): p is PersonDTO => Boolean(p))
    .sort((a, b) => Number(b.isMe) - Number(a.isMe) || a.name.localeCompare(b.name));
  const privateCount = all.filter((u) => u.visibility === "private" && String(u._id) !== String(user._id)).length;
  return json({ people, privateCount });
});
