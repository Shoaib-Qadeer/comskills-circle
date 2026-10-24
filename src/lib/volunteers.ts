import { collections } from "./db";
import { ACTIVE_MEMBER } from "./access";
import { photoUrlFor } from "./serialize";
import { batchLabel, getSettings } from "./settings";
import type { UserDoc, VolunteerFor } from "./types";

export type VolunteerFilters = { openOnly: boolean; for: VolunteerFor | null; area: string | null; minHours: number | null; batch: string | null };

export function parseVolunteerFilters(url: string): VolunteerFilters {
  const sp = new URL(url).searchParams;
  const f = sp.get("for");
  const h = Number(sp.get("minHours"));
  return {
    openOnly: sp.get("all") !== "1",
    for: f === "comskills" || f === "other" || f === "both" ? f : null,
    area: sp.get("area")?.slice(0, 60) || null,
    minHours: Number.isFinite(h) && h > 0 ? Math.min(200, h) : null,
    batch: sp.get("batch") || null,
  };
}

type V = Pick<UserDoc, "volunteering" | "batch">;

/**
 * Pure filter. "For Comskills" also includes people who said "both" (and the same for "other"),
 * since they're available for either.
 */
export function volunteerMatches(u: V, f: VolunteerFilters): boolean {
  const v = u.volunteering;
  if (f.openOnly && !v?.open) return false;
  if (f.for && f.for !== "both" && v?.for !== f.for && v?.for !== "both") return false;
  if (f.for === "both" && v?.for !== "both") return false;
  if (f.area && !(v?.areas ?? []).includes(f.area)) return false;
  if (f.minHours && (v?.hoursPerMonth ?? 0) < f.minHours) return false;
  if (f.batch && u.batch !== f.batch) return false;
  return true;
}

export type VolunteerRow = {
  id: string;
  name: string;
  photoUrl: string | null;
  batch: string | null;
  fieldOfStudy: string;
  open: boolean;
  for: VolunteerFor | null;
  areas: string[];
  hoursPerMonth: number | null;
};

/** The volunteer list for the team (no contact details; use the profile's Connect button for those). */
export async function volunteerList(f: VolunteerFilters): Promise<{ items: VolunteerRow[]; batches: { id: string; label: string }[]; totalOpen: number }> {
  const [{ users }, settings] = await Promise.all([collections(), getSettings()]);
  const people = await users
    .find(ACTIVE_MEMBER, { projection: { name: 1, hasPhoto: 1, photoVersion: 1, batch: 1, fieldOfStudy: 1, volunteering: 1 } })
    .sort({ "volunteering.hoursPerMonth": -1, name: 1 })
    .toArray();
  return {
    items: people
      .filter((u) => volunteerMatches(u, f))
      .map((u) => ({
        id: String(u._id),
        name: u.name,
        photoUrl: photoUrlFor(u),
        batch: batchLabel(settings, u.batch),
        fieldOfStudy: u.fieldOfStudy || "",
        open: Boolean(u.volunteering?.open),
        for: u.volunteering?.for ?? null,
        areas: u.volunteering?.areas ?? [],
        hoursPerMonth: u.volunteering?.hoursPerMonth ?? null,
      })),
    batches: settings.batches.map((b) => ({ id: b.id, label: b.label })),
    totalOpen: people.filter((u) => u.volunteering?.open).length,
  };
}
