import type { Filter, ObjectId } from "mongodb";
import { collections } from "./db";
import { dateFromKey, localDayKey } from "./time";
import type { OpportunityDoc } from "./types";

/** Today's date (app time zone) as a UTC-midnight Date, the way date-only values are stored. */
export function todayStored(now: Date = new Date()): Date {
  return dateFromKey(localDayKey(now));
}

/** Open = no deadline, or deadline today or later (Karachi day). Archive = deadline before today. */
export function statusFilter(status: "open" | "archive", now: Date = new Date()): Filter<OpportunityDoc> {
  const today = todayStored(now);
  return status === "open" ? { $or: [{ deadline: null }, { deadline: { $gte: today } }] } : { deadline: { $lt: today } };
}

export const dateOrNull = (s: string | null | undefined) => (s ? dateFromKey(s.slice(0, 10)) : null);

/** The viewer's tracker entries keyed by opportunity id (for the "Track this" button state). */
export async function trackedMap(userId: ObjectId, oppIds: ObjectId[]): Promise<Map<string, string>> {
  if (!oppIds.length) return new Map();
  const { scholarships } = await collections();
  const rows = await scholarships.find({ userId, opportunityId: { $in: oppIds } }, { projection: { opportunityId: 1 } }).toArray();
  return new Map(rows.map((r) => [String(r.opportunityId), String(r._id)]));
}

/** Fields that change who an opportunity matches; editing any of them re-runs matching. */
export const MATCH_FIELDS = ["title", "summary", "fields", "tags", "location", "country", "remote", "type", "degreeLevel", "funding", "paid", "durationMonths", "eligibility"];
