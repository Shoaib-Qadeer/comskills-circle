import { z } from "zod";
import type { ObjectId } from "mongodb";
import { isHttpUrl } from "./url";
import { dateFromKey, dateOnlyKey, daysUntil } from "./time";
import { scholarshipVisibleTo } from "./visibility";
import type { MiniUserDTO, ScholarshipDoc, ScholarshipStage, UserDoc } from "./types";

export const STAGES: ScholarshipStage[] = ["applying", "applied", "rejected", "accepted"];
export const STAGE_LABEL: Record<ScholarshipStage, string> = { applying: "Applying", applied: "Applied", rejected: "Rejected", accepted: "Accepted" };

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-03-15")
  .nullable()
  .optional();

/** Everything an entry can hold; which fields matter depends on the stage. */
export const scholarshipInputSchema = z
  .object({
    name: z.string().trim().min(2, "Add the scholarship's name").max(120),
    country: z.string().trim().min(2, "Add the country").max(60),
    link: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || isHttpUrl(v), "The link should start with https://"),
    opportunityId: z.string().nullable().optional(),
    stage: z.enum(["applying", "applied", "rejected", "accepted"]),
    deadline: isoDate,
    submittedAt: isoDate,
    expectedResultAt: isoDate,
    rejectedAt: isoDate,
    lesson: z.string().trim().max(400).nullable().optional(),
    programme: z.string().trim().max(120).nullable().optional(),
    university: z.string().trim().max(120).nullable().optional(),
    startDate: isoDate,
    rejectedVisibility: z.enum(["team", "members"]).optional(),
    announceConsent: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.stage === "applied" && !v.submittedAt) ctx.addIssue({ code: "custom", path: ["submittedAt"], message: "Add the date you submitted" });
    if (v.stage === "accepted" && !v.programme?.trim()) ctx.addIssue({ code: "custom", path: ["programme"], message: "Add the programme you were accepted to" });
  });
export type ScholarshipInput = z.infer<typeof scholarshipInputSchema>;

/** A move or an edit: the same fields, all optional except what the target stage needs. */
export const scholarshipPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    country: z.string().trim().min(2).max(60).optional(),
    link: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional()
      .refine((v) => !v || isHttpUrl(v), "The link should start with https://"),
    stage: z.enum(["applying", "applied", "rejected", "accepted"]).optional(),
    deadline: isoDate,
    submittedAt: isoDate,
    expectedResultAt: isoDate,
    rejectedAt: isoDate,
    lesson: z.string().trim().max(400).nullable().optional(),
    programme: z.string().trim().max(120).nullable().optional(),
    university: z.string().trim().max(120).nullable().optional(),
    startDate: isoDate,
    rejectedVisibility: z.enum(["team", "members"]).optional(),
    announceConsent: z.boolean().optional(),
  })
  .strict();

const d = (v: string | null | undefined) => (v ? dateFromKey(v) : null);

/** Turns validated input into the stored fields (dates as UTC midnight). */
export function toStoredFields(v: Partial<ScholarshipInput>): Partial<ScholarshipDoc> {
  const out: Partial<ScholarshipDoc> = {};
  if (v.name !== undefined) out.name = v.name;
  if (v.country !== undefined) out.country = v.country;
  if (v.link !== undefined) out.link = v.link || null;
  if (v.stage !== undefined) out.stage = v.stage;
  for (const k of ["deadline", "submittedAt", "expectedResultAt", "rejectedAt", "startDate"] as const) if (v[k] !== undefined) out[k] = d(v[k]);
  if (v.lesson !== undefined) out.lesson = v.lesson?.trim() || null;
  if (v.programme !== undefined) out.programme = v.programme?.trim() || null;
  if (v.university !== undefined) out.university = v.university?.trim() || null;
  if (v.rejectedVisibility !== undefined) out.rejectedVisibility = v.rejectedVisibility;
  if (v.announceConsent !== undefined) out.announceConsent = v.announceConsent;
  return out;
}

/** What a stage move needs before it can be saved (null = fine). */
export function moveProblem(entry: Pick<ScholarshipDoc, "submittedAt" | "programme">, to: ScholarshipStage, patch: { submittedAt?: string | null; programme?: string | null }): string | null {
  if (to === "applied" && !(patch.submittedAt ?? (entry.submittedAt ? "x" : null))) return "Add the date you submitted.";
  if (to === "accepted" && !(patch.programme ?? entry.programme)?.trim()) return "Add the programme you were accepted to.";
  return null;
}

/* ------------------------------------------------------------------ DTO */

export interface ScholarshipDTO {
  id: string;
  owner: MiniUserDTO | null;
  ownerBatch: string | null;
  name: string;
  country: string;
  link: string | null;
  opportunityId: string | null;
  stage: ScholarshipStage;
  deadline: string | null;
  submittedAt: string | null;
  expectedResultAt: string | null;
  rejectedAt: string | null;
  lesson: string | null;
  programme: string | null;
  university: string | null;
  startDate: string | null;
  rejectedVisibility: "team" | "members";
  announceConsent: boolean;
  announcedAt: string | null;
  isMine: boolean;
  history: { stage: ScholarshipStage; at: string }[];
  createdAt: string;
  updatedAt: string;
}

const key = (x: Date | null | undefined) => (x ? dateOnlyKey(x) : null);

export function scholarshipDTO(s: ScholarshipDoc, viewerId: ObjectId | string, owner?: { mini: MiniUserDTO; batch: string | null } | null): ScholarshipDTO {
  return {
    id: String(s._id),
    owner: owner?.mini ?? null,
    ownerBatch: owner?.batch ?? null,
    name: s.name,
    country: s.country,
    link: isHttpUrl(s.link) ? s.link : null,
    opportunityId: s.opportunityId ? String(s.opportunityId) : null,
    stage: s.stage,
    deadline: key(s.deadline),
    submittedAt: key(s.submittedAt),
    expectedResultAt: key(s.expectedResultAt),
    rejectedAt: key(s.rejectedAt),
    lesson: s.lesson,
    programme: s.programme,
    university: s.university,
    startDate: key(s.startDate),
    rejectedVisibility: s.rejectedVisibility,
    announceConsent: s.announceConsent,
    announcedAt: s.announcedAt ? s.announcedAt.toISOString() : null,
    isMine: String(s.userId) === String(viewerId),
    history: (s.history ?? []).map((h) => ({ stage: h.stage, at: h.at.toISOString() })),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

/** Entries of one member that a given viewer may see (used on profiles). */
export function visibleEntries(entries: ScholarshipDoc[], viewer: Pick<UserDoc, "_id" | "isAdmin"> & { isTeam: boolean }): ScholarshipDoc[] {
  return entries.filter((e) =>
    scholarshipVisibleTo({ userId: String(e.userId), stage: e.stage, rejectedVisibility: e.rejectedVisibility }, { id: String(viewer._id), isAdmin: viewer.isAdmin, isTeam: viewer.isTeam }),
  );
}

/* ------------------------------------------------------------------ team summary (pure) */

export type SummaryMember = { id: string; name: string; batch: string | null; updatedAt: Date };
export type Summary = {
  counts: Record<ScholarshipStage, number>;
  byBatch: { batch: string | null; counts: Record<ScholarshipStage, number> }[];
  upcoming: { entry: ScholarshipDoc; days: number }[];
  wins: ScholarshipDoc[];
  quiet: { member: SummaryMember; lastUpdate: Date | null; entries: number }[];
};

const zero = (): Record<ScholarshipStage, number> => ({ applying: 0, applied: 0, rejected: 0, accepted: 0 });

/**
 * The team's view: counts per stage (overall and per batch), Applying deadlines in the next 30
 * days, consented wins not yet announced, and members with no entry or nothing updated in 60+ days.
 */
export function buildSummary(entries: ScholarshipDoc[], members: SummaryMember[], now: Date = new Date(), tz?: string): Summary {
  const counts = zero();
  const batchOf = new Map(members.map((m) => [m.id, m.batch]));
  const byBatchMap = new Map<string, Record<ScholarshipStage, number>>();
  const lastByUser = new Map<string, Date>();
  const nByUser = new Map<string, number>();
  for (const e of entries) {
    counts[e.stage]++;
    const b = batchOf.get(String(e.userId)) ?? null;
    const k = b ?? "";
    if (!byBatchMap.has(k)) byBatchMap.set(k, zero());
    byBatchMap.get(k)![e.stage]++;
    const prev = lastByUser.get(String(e.userId));
    if (!prev || e.updatedAt > prev) lastByUser.set(String(e.userId), e.updatedAt);
    nByUser.set(String(e.userId), (nByUser.get(String(e.userId)) ?? 0) + 1);
  }
  const upcoming = entries
    .filter((e) => e.stage === "applying" && e.deadline)
    .map((e) => ({ entry: e, days: daysUntil(e.deadline!, now, tz) }))
    .filter((x) => x.days >= 0 && x.days <= 30)
    .sort((a, b) => a.days - b.days);
  const wins = entries.filter((e) => e.stage === "accepted" && e.announceConsent && !e.announcedAt).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const sixtyDaysAgo = now.getTime() - 60 * 86_400_000;
  const quiet = members
    .map((m) => ({ member: m, lastUpdate: lastByUser.get(m.id) ?? null, entries: nByUser.get(m.id) ?? 0 }))
    .filter((q) => !q.lastUpdate || q.lastUpdate.getTime() < sixtyDaysAgo)
    .sort((a, b) => (a.lastUpdate?.getTime() ?? 0) - (b.lastUpdate?.getTime() ?? 0));
  return {
    counts,
    byBatch: Array.from(byBatchMap, ([b, c]) => ({ batch: b || null, counts: c })).sort((a, b) => (a.batch ?? "~").localeCompare(b.batch ?? "~")),
    upcoming,
    wins,
    quiet,
  };
}
