import { describe, it, expect } from "vitest";
import { ObjectId } from "mongodb";
import { buildSummary, moveProblem, scholarshipInputSchema, toStoredFields, visibleEntries } from "../src/lib/scholarships";
import type { ScholarshipDoc } from "../src/lib/types";

const NOW = new Date("2026-10-24T06:00:00Z"); // 11:00 in Karachi
const day = (n: number) => new Date(Date.UTC(2026, 9, 24 + n));
const a = new ObjectId(), b = new ObjectId(), c = new ObjectId();
function e(userId: ObjectId, stage: ScholarshipDoc["stage"], over: Partial<ScholarshipDoc> = {}): ScholarshipDoc {
  return {
    _id: new ObjectId(), userId, name: "DAAD", country: "Germany", link: null, opportunityId: null, stage,
    deadline: null, submittedAt: null, expectedResultAt: null, rejectedAt: null, lesson: null, programme: null, university: null, startDate: null,
    rejectedVisibility: "team", announceConsent: false, announcedAt: null, remindersSent: [], history: [], createdAt: day(-5), updatedAt: day(-5), ...over,
  };
}

describe("team summary", () => {
  const entries = [
    e(a, "applying", { deadline: day(3) }),
    e(a, "applying", { deadline: day(40) }),
    e(a, "applying", { deadline: day(-2) }),
    e(b, "accepted", { announceConsent: true, programme: "MSc" }),
    e(b, "accepted", { announceConsent: true, announcedAt: day(-1) }),
    e(b, "accepted", { announceConsent: false }),
    e(b, "rejected", { updatedAt: day(-90) }),
  ];
  const members = [
    { id: String(a), name: "A", batch: "b1", updatedAt: day(-1) },
    { id: String(b), name: "B", batch: "b2", updatedAt: day(-1) },
    { id: String(c), name: "C", batch: "b1", updatedAt: day(-1) },
  ];
  const s = buildSummary(entries, members, NOW, "Asia/Karachi");
  it("counts per stage, overall and per batch", () => {
    expect(s.counts).toEqual({ applying: 3, applied: 0, rejected: 1, accepted: 3 });
    expect(s.byBatch.find((x) => x.batch === "b1")?.counts.applying).toBe(3);
    expect(s.byBatch.find((x) => x.batch === "b2")?.counts.accepted).toBe(3);
  });
  it("upcoming = Applying deadlines in the next 30 days, soonest first", () => {
    expect(s.upcoming.map((u) => u.days)).toEqual([3]);
  });
  it("wins = accepted, consented and not yet announced", () => {
    expect(s.wins).toHaveLength(1);
    expect(s.wins[0].programme).toBe("MSc");
  });
  it("quiet = no entry, or nothing updated in 60+ days", () => {
    expect(s.quiet.map((q) => q.member.name)).toEqual(["C"]);
    const later = buildSummary(entries, members, new Date("2027-02-01T00:00:00Z"));
    expect(later.quiet.map((q) => q.member.name).sort()).toEqual(["A", "B", "C"]);
  });
});

describe("stage rules", () => {
  it("each stage asks for its own fields", () => {
    const base = { name: "Chevening", country: "United Kingdom" };
    expect(scholarshipInputSchema.safeParse({ ...base, stage: "applying" }).success).toBe(true);
    expect(scholarshipInputSchema.safeParse({ ...base, stage: "applied" }).success).toBe(false);
    expect(scholarshipInputSchema.safeParse({ ...base, stage: "applied", submittedAt: "2026-10-01" }).success).toBe(true);
    expect(scholarshipInputSchema.safeParse({ ...base, stage: "accepted" }).success).toBe(false);
    expect(scholarshipInputSchema.safeParse({ ...base, stage: "accepted", programme: "MSc Public Health" }).success).toBe(true);
    expect(scholarshipInputSchema.safeParse({ ...base, stage: "applying", link: "javascript:x" }).success).toBe(false);
  });
  it("moves check what the next stage needs", () => {
    expect(moveProblem({ submittedAt: null, programme: null }, "applied", {})).toMatch(/submitted/);
    expect(moveProblem({ submittedAt: null, programme: null }, "applied", { submittedAt: "2026-10-01" })).toBeNull();
    expect(moveProblem({ submittedAt: null, programme: null }, "accepted", { programme: " " })).toMatch(/programme/);
    expect(moveProblem({ submittedAt: null, programme: null }, "rejected", {})).toBeNull();
  });
  it("dates are stored as UTC midnight", () => {
    expect(toStoredFields({ deadline: "2027-03-15" }).deadline?.toISOString()).toBe("2027-03-15T00:00:00.000Z");
    expect(toStoredFields({ deadline: null }).deadline).toBeNull();
  });
  it("profile lists hide team-only rejections from other members", () => {
    const list = [e(a, "rejected"), e(a, "rejected", { rejectedVisibility: "members" }), e(a, "applied")];
    expect(visibleEntries(list, { _id: b, isAdmin: false, isTeam: false })).toHaveLength(2);
    expect(visibleEntries(list, { _id: b, isAdmin: false, isTeam: true })).toHaveLength(3);
    expect(visibleEntries(list, { _id: a, isAdmin: false, isTeam: false })).toHaveLength(3);
  });
});
