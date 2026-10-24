import { requireUser, ACTIVE_MEMBER } from "@/lib/auth";
import { route, json } from "@/lib/api";
import { collections } from "@/lib/db";
import { getField } from "@/lib/taxonomy";
import { photoUrlFor, safeLinks } from "@/lib/serialize";
import type { ConstellationDTO } from "@/lib/types";

function normLocation(l: string): string {
  const t = l.trim();
  return t.length ? t[0].toUpperCase() + t.slice(1) : t;
}

export const GET = route(async () => {
  const user = await requireUser();
  const { users } = await collections();
  const visible = await users.find(ACTIVE_MEMBER).toArray();
  const privateCount = 0;

  const hubCounts = new Map<string, number>();
  const locCounts = new Map<string, number>();
  for (const u of visible) {
    for (const f of u.fields) hubCounts.set(f, (hubCounts.get(f) || 0) + 1);
    const l = normLocation(u.city || "");
    if (l) locCounts.set(l, (locCounts.get(l) || 0) + 1);
  }

  const payload: ConstellationDTO = {
    people: visible.map((u) => ({
      id: String(u._id),
      name: u.name,
      photoUrl: photoUrlFor(u),
      headline: u.fieldOfStudy || "",
      fields: u.fields,
      preferredLocations: u.city ? [normLocation(u.city)] : [],
      links: safeLinks(u.links),
      open: Boolean(u.volunteering?.open),
      isMe: String(u._id) === String(user._id),
    })),
    hubs: Array.from(hubCounts, ([slug, count]) => ({ ...getField(slug), count })).sort((a, b) => b.count - a.count),
    locations: Array.from(locCounts, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    privateCount,
    meIncluded: user.onboarded,
  };
  return json(payload);
});
