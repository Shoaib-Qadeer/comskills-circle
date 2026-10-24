import { requireUser, ACTIVE_MEMBER } from "@/lib/auth";
import { route, json } from "@/lib/api";
import { collections } from "@/lib/db";
import { memberCardDTO } from "@/lib/serialize";
import { getSettings } from "@/lib/settings";

/**
 * Every approved, onboarded member as a light card (no contacts). One request; the directory
 * filters on the phone, which keeps it fast on slow mobile data.
 */
export const GET = route(async () => {
  const user = await requireUser();
  const { users } = await collections();
  const settings = await getSettings();
  const all = await users
    .find(ACTIVE_MEMBER, {
      projection: { name: 1, email: 1, hasPhoto: 1, photoVersion: 1, role: 1, teamTitle: 1, batch: 1, university: 1, city: 1, fieldOfStudy: 1, skills: 1, lookingFor: 1, volunteering: 1, fields: 1 },
    })
    .limit(3000)
    .toArray();
  const items = all
    .map((u) => memberCardDTO(u as never, user._id, settings))
    .sort((a, b) => Number(b.isMe) - Number(a.isMe) || a.name.localeCompare(b.name));
  return json({ items });
});
