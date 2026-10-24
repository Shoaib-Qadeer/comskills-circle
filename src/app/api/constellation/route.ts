import { requireUser, ACTIVE_MEMBER } from "@/lib/auth";
import { route, json } from "@/lib/api";
import { collections } from "@/lib/db";
import { getField } from "@/lib/taxonomy";
import { isHttpUrl } from "@/lib/url";
import type { ConstellationDTO } from "@/lib/types";

function normLocation(l: string): string {
  const t = l.trim();
  return t.length ? t[0].toUpperCase() + t.slice(1) : t;
}

export const GET = route(async () => {
  const user = await requireUser();
  const { users } = await collections();
  const all = await users.find(ACTIVE_MEMBER).toArray();
  // The viewer always sees themselves, even if private; other private profiles are never included.
  const visible = all.filter((u) => u.visibility !== "private" || String(u._id) === String(user._id));
  const privateCount = all.filter((u) => u.visibility === "private" && String(u._id) !== String(user._id)).length;
  const visibleIds = new Set(visible.map((u) => String(u._id)));

  const hubCounts = new Map<string, number>();
  const locCounts = new Map<string, number>();
  for (const u of visible) {
    for (const f of u.fields) hubCounts.set(f, (hubCounts.get(f) || 0) + 1);
    for (const l of new Set(u.preferredLocations.map(normLocation))) if (l) locCounts.set(l, (locCounts.get(l) || 0) + 1);
  }

  const payload: ConstellationDTO = {
    people: visible.map((u) => ({
      id: String(u._id),
      name: u.name,
      photoUrl: u.photoUrl,
      headline: u.headline,
      fields: u.fields,
      preferredLocations: Array.from(new Set(u.preferredLocations.map(normLocation))).filter(Boolean),
      links: Object.fromEntries(Object.entries(u.links || {}).filter(([, v]) => isHttpUrl(v as string))),
      open: u.visibility === "open",
      isMe: String(u._id) === String(user._id),
    })),
    hubs: Array.from(hubCounts, ([slug, count]) => ({ ...getField(slug), count })).sort((a, b) => b.count - a.count),
    locations: Array.from(locCounts, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    privateCount,
    meIncluded: user.onboarded,
  };
  return json(payload);
});
