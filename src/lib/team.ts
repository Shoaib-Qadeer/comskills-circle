import type { Filter } from "mongodb";
import { collections } from "./db";
import { ACTIVE_MEMBER } from "./access";
import { buildSummary, scholarshipDTO, type ScholarshipDTO } from "./scholarships";
import { photoUrlFor } from "./serialize";
import { getSettings, batchLabel } from "./settings";
import type { ScholarshipDoc, ScholarshipStage, UserDoc } from "./types";

export type TeamFilters = { batch: string | null; stage: ScholarshipStage | null; country: string | null };

export function parseFilters(url: string): TeamFilters {
  const sp = new URL(url).searchParams;
  const stage = sp.get("stage");
  return {
    batch: sp.get("batch") || null,
    stage: stage && ["applying", "applied", "rejected", "accepted"].includes(stage) ? (stage as ScholarshipStage) : null,
    country: sp.get("country")?.trim().slice(0, 60) || null,
  };
}

/** Everything the team summary shows. Team and admins see every entry, including team-only rejections. */
export async function teamScholarshipData(f: TeamFilters, viewerId: UserDoc["_id"]) {
  const c = await collections();
  const settings = await getSettings();
  const members = await c.users
    .find(ACTIVE_MEMBER, { projection: { name: 1, batch: 1, role: 1, hasPhoto: 1, photoVersion: 1, updatedAt: 1, email: 1 } })
    .toArray();
  const inBatch = f.batch ? members.filter((m) => (f.batch === "none" ? !m.batch : m.batch === f.batch)) : members;
  const ids = inBatch.map((m) => m._id);
  const q: Filter<ScholarshipDoc> = { userId: { $in: ids } };
  const all = await c.scholarships.find(q).toArray();
  const summary = buildSummary(
    all,
    inBatch.map((m) => ({ id: String(m._id), name: m.name, batch: m.batch ?? null, updatedAt: m.updatedAt })),
  );
  const ownerOf = new Map(inBatch.map((m) => [String(m._id), { mini: { id: String(m._id), name: m.name, photoUrl: photoUrlFor(m as UserDoc) }, batch: batchLabel(settings, m.batch) }]));
  const dto = (s: ScholarshipDoc): ScholarshipDTO => scholarshipDTO(s, viewerId, ownerOf.get(String(s.userId)) ?? null);
  const countryNeedle = f.country?.toLowerCase();
  const entries = all
    .filter((s) => (!f.stage || s.stage === f.stage) && (!countryNeedle || s.country.toLowerCase().includes(countryNeedle)))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .map(dto);
  return {
    counts: summary.counts,
    byBatch: summary.byBatch.map((b) => ({ batch: b.batch, label: b.batch ? batchLabel(settings, b.batch) ?? b.batch : "No batch", counts: b.counts })),
    upcoming: summary.upcoming.map((u) => ({ days: u.days, entry: dto(u.entry) })),
    wins: summary.wins.map(dto),
    quiet: summary.quiet.slice(0, 200).map((q) => ({
      member: ownerOf.get(q.member.id)!.mini,
      batch: ownerOf.get(q.member.id)!.batch,
      lastUpdate: q.lastUpdate ? q.lastUpdate.toISOString() : null,
      entries: q.entries,
    })),
    entries: entries.slice(0, 1000),
    countries: Array.from(new Set(all.map((s) => s.country))).sort(),
    batches: settings.batches.map((b) => ({ id: b.id, label: b.label })),
    memberCount: inBatch.length,
  };
}
