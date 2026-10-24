import type { ObjectId } from "mongodb";
import { collections } from "./db";
import { normalizeUrl } from "./url";
import { onlyValidFields } from "./taxonomy";
import { matchOpportunity } from "./matching";
import { STARTER_OPPORTUNITIES, type StarterOpportunity } from "./starter-opportunities";
import type { OpportunityDoc } from "./types";

/** Starter items can share a listing page, so their duplicate key includes the item id. */
export function starterKey(s: StarterOpportunity): string {
  return `${normalizeUrl(s.url) ?? s.url}#starter:${s.id}`;
}

const day = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`) : null);

export async function starterStatus(): Promise<{ id: string; title: string; domain: string; imported: boolean; deadline: string | null }[]> {
  const { opportunities } = await collections();
  const keys = STARTER_OPPORTUNITIES.map(starterKey);
  const existing = await opportunities.find({ urlKey: { $in: keys } }, { projection: { urlKey: 1 } }).toArray();
  const have = new Set(existing.map((e) => e.urlKey));
  return STARTER_OPPORTUNITIES.map((s) => ({ id: s.id, title: s.title, domain: s.domain, imported: have.has(starterKey(s)), deadline: s.deadline }));
}

/** Inserts one starter opportunity (if not already there) and matches it to classmates. */
export async function importStarter(id: string, postedBy: ObjectId | null, opts: { match?: boolean } = {}) {
  const s = STARTER_OPPORTUNITIES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown starter id ${id}`);
  const { opportunities } = await collections();
  const urlKey = starterKey(s);
  const existing = await opportunities.findOne({ urlKey }, { projection: { _id: 1 } });
  if (existing) return { status: "exists" as const, id: String(existing._id), matchCount: null };
  const now = new Date();
  const doc: Omit<OpportunityDoc, "_id"> = {
    url: s.url,
    urlKey,
    postedBy,
    title: s.title,
    organization: s.organization,
    location: s.location,
    remote: s.remote,
    type: s.type,
    deadline: day(s.deadline),
    startDate: day(s.startDate),
    durationMonths: s.durationMonths,
    paid: s.paid,
    frenchRequired: s.frenchRequired,
    fields: onlyValidFields(s.fields).slice(0, 4),
    tags: s.tags.slice(0, 6),
    eligibility: s.eligibility,
    summary: s.summary,
    taggedFor: [],
    posterNote: null,
    matchCount: 0,
    starter: true,
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await opportunities.insertOne(doc as OpportunityDoc);
  const matchCount = opts.match === false ? null : await matchOpportunity(insertedId);
  return { status: "imported" as const, id: String(insertedId), matchCount };
}
