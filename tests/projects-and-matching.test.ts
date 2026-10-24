import { describe, it, expect } from "vitest";
import { ObjectId } from "mongodb";
import { applyStatus, canProposerSet, interestBlocker, proposalInputSchema, shouldOfferStart, teamCounts, proposalDetailDTO } from "../src/lib/proposals";
import { chunk, scoreInChunks, proposalForLlm } from "../src/lib/matching";
import { LlmUnavailableError } from "../src/lib/llm";
import type { ProposalDoc, ProposalMemberDoc } from "../src/lib/types";

const me = new ObjectId();
const proposer = new ObjectId();
const base = { proposedBy: proposer, status: "open" as const, acceptingMembers: true };

describe("proposal rules", () => {
  it("you can't join your own project", () => {
    expect(interestBlocker(base, String(proposer), null)).toMatch(/own project/);
    expect(interestBlocker(base, String(me), null)).toBeNull();
  });
  it("the accepting toggle closes the door, except for invited people", () => {
    const closed = { ...base, acceptingMembers: false };
    expect(interestBlocker(closed, String(me), null)).toMatch(/isn't taking new members/);
    expect(interestBlocker(closed, String(me), "left")).toMatch(/isn't taking new members/);
    expect(interestBlocker(closed, String(me), "invited")).toBeNull();
  });
  it("completed projects and repeat states are blocked", () => {
    expect(interestBlocker({ ...base, status: "completed" }, String(me), null)).toMatch(/completed/);
    expect(interestBlocker(base, String(me), "interested")).toMatch(/already/);
    expect(interestBlocker(base, String(me), "accepted")).toMatch(/already on this team/);
    expect(interestBlocker(base, String(me), "declined")).toBeTruthy();
    expect(interestBlocker(base, String(me), "removed")).toBeTruthy();
    expect(interestBlocker(base, String(me), "left")).toBeNull();
  });
  it("counts and the 'team complete' offer", () => {
    expect(teamCounts(4, 2)).toEqual({ accepted: 2, needed: 4, openSpots: 2, full: false });
    expect(teamCounts(3, 3).full).toBe(true);
    expect(teamCounts(2, 5).openSpots).toBe(0);
    const p = { status: "team_forming" as const, acceptingMembers: true, peopleNeeded: { count: 3, skills: [] } };
    expect(shouldOfferStart(p, 2)).toBe(false);
    expect(shouldOfferStart(p, 3)).toBe(true);
    expect(shouldOfferStart({ ...p, status: "in_progress", acceptingMembers: false }, 3)).toBe(false);
  });
  it("completing closes the project to new people; other moves keep the toggle", () => {
    expect(applyStatus("completed", true)).toEqual({ status: "completed", acceptingMembers: false });
    expect(applyStatus("in_progress", true)).toEqual({ status: "in_progress", acceptingMembers: true });
  });
  it("proposer transitions", () => {
    expect(canProposerSet("interested", "accepted")).toBe(true);
    expect(canProposerSet("invited", "accepted")).toBe(false); // they must say yes first
    expect(canProposerSet("accepted", "removed")).toBe(true);
    expect(canProposerSet("interested", "removed")).toBe(false);
    expect(canProposerSet("declined", "accepted")).toBe(true);
  });
  it("input limits match the plan", () => {
    const ok = {
      title: "Dengue early-warning map",
      problem: "Dengue outbreaks surprise hospitals every monsoon.",
      idea: "Combine weather data and case reports into a weekly risk map.",
      peopleNeeded: { count: 3, skills: ["Python", "python", "GIS"] },
      commitment: { hoursPerWeek: 5, duration: "8 weeks" },
      fields: ["public-health"],
      tags: ["GIS"],
      links: ["https://github.com/x/y"],
    };
    const parsed = proposalInputSchema.parse(ok);
    expect(parsed.peopleNeeded.skills).toEqual(["python", "GIS"].map((s, i) => (i === 0 ? "python" : s)));
    expect(parsed.tags).toEqual(["gis"]);
    expect(proposalInputSchema.safeParse({ ...ok, title: "x".repeat(91) }).success).toBe(false);
    expect(proposalInputSchema.safeParse({ ...ok, peopleNeeded: { count: 21, skills: [] } }).success).toBe(false);
    expect(proposalInputSchema.safeParse({ ...ok, links: ["a", "b", "c", "d"].map((x) => `https://${x}.com`) }).success).toBe(false);
    expect(proposalInputSchema.safeParse({ ...ok, links: ["javascript:alert(1)"] }).success).toBe(false);
  });
});

describe("who sees who's interested", () => {
  const now = new Date();
  const p: ProposalDoc = {
    _id: new ObjectId(),
    proposedBy: proposer,
    title: "T",
    problem: "P",
    idea: "I",
    peopleNeeded: { count: 2, skills: [] },
    commitment: { hoursPerWeek: null, duration: "" },
    fields: [],
    tags: [],
    links: [],
    status: "open",
    acceptingMembers: true,
    statusChangedAt: now,
    matchCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  const a = new ObjectId(), b = new ObjectId(), pend = new ObjectId();
  const people = new Map(
    [
      [a, "Accepted Ali", "approved"],
      [b, "Interested Bina", "approved"],
      [pend, "Pending Person", "pending"],
      [proposer, "Proposer", "approved"],
    ].map(([id, name, status]) => [String(id), { _id: id as ObjectId, name: name as string, hasPhoto: false, photoVersion: 0, fieldOfStudy: "", skills: [], status: status as "approved", onboarded: true }]),
  );
  const m = (userId: ObjectId, status: ProposalMemberDoc["status"]): ProposalMemberDoc => ({ _id: new ObjectId(), proposalId: p._id, userId, status, note: "I can help", invitedBy: null, createdAt: now, decidedAt: null });
  const members = [m(a, "accepted"), m(b, "interested"), m(pend, "accepted")];
  it("the team is public, the interested list is only for the proposer and admins", () => {
    const visitor = proposalDetailDTO(p, { _id: me, isAdmin: false }, { people, members, match: null });
    expect(visitor.teamMembers.map((t) => t.name)).toEqual(["Accepted Ali"]);
    expect(visitor.manage).toBeNull();
    expect(JSON.stringify(visitor)).not.toContain("Interested Bina");
    const owner = proposalDetailDTO(p, { _id: proposer, isAdmin: false }, { people, members, match: null });
    expect(owner.manage?.interested.map((t) => t.name)).toEqual(["Interested Bina"]);
    const admin = proposalDetailDTO(p, { _id: new ObjectId(), isAdmin: true }, { people, members, match: null });
    expect(admin.canManage).toBe(true);
  });
  it("pending or declined accounts never show on a team", () => {
    const visitor = proposalDetailDTO(p, { _id: me, isAdmin: false }, { people, members, match: null });
    expect(JSON.stringify(visitor)).not.toContain("Pending Person");
    expect(visitor.acceptedCount).toBe(1);
  });
  it("proposals sent to the AI have contact details scrubbed", () => {
    const leaky = { ...p, problem: "Call me at 0300 1234567 or ali@x.com", idea: "See https://drive.google.com/abc" };
    const json = JSON.stringify(proposalForLlm(leaky));
    expect(json).not.toMatch(/0300|ali@x|drive\.google/);
  });
});

describe("chunked matching", () => {
  const people = Array.from({ length: 95 }, (_, i) => ({ id: `m${i}` }));
  it("splits 95 profiles into 3 calls of at most 40, at most 2 at a time", async () => {
    expect(chunk(people, 40).map((c) => c.length)).toEqual([40, 40, 15]);
    let inFlight = 0;
    let maxInFlight = 0;
    const sizes: number[] = [];
    const { scores, calls, aiScored } = await scoreInChunks({
      items: people,
      key: (p) => p.id,
      chunkSize: 40,
      parallel: 2,
      deadline: Date.now() + 10_000,
      aliasPrefix: "u",
      call: async (batch) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        sizes.push(batch.length);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        // aliases only: the model never sees our ids
        expect(batch.every((b, i) => b.alias === `u${i + 1}`)).toBe(true);
        return batch.map((b) => ({ id: b.alias, score: 70, reason: "fits" }));
      },
      fallback: () => ({ score: 1, reason: "basic" }),
    });
    expect(calls).toBe(3);
    expect(sizes.sort((a, b) => b - a)).toEqual([40, 40, 15]);
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(aiScored).toBe(95);
    expect(scores.get("m94")).toEqual({ score: 70, reason: "fits", basic: false });
  });
  it("falls back to rules for everyone when the AI throws, and stops calling once the budget is gone", async () => {
    let calls = 0;
    const { scores, aiScored } = await scoreInChunks({
      items: people,
      key: (p) => p.id,
      chunkSize: 40,
      parallel: 1,
      deadline: Date.now() + 10_000,
      aliasPrefix: "u",
      call: async () => {
        calls++;
        throw new LlmUnavailableError("Daily AI call limit reached");
      },
      fallback: () => ({ score: 42, reason: "rule" }),
    });
    expect(calls).toBe(1);
    expect(aiScored).toBe(0);
    expect(scores.size).toBe(95);
    expect([...scores.values()].every((s) => s.basic && s.score === 42)).toBe(true);
  });
  it("one failing chunk only affects that chunk", async () => {
    let n = 0;
    const { scores } = await scoreInChunks({
      items: people,
      key: (p) => p.id,
      chunkSize: 40,
      parallel: 2,
      deadline: Date.now() + 10_000,
      aliasPrefix: "u",
      call: async (batch) => {
        if (n++ === 1) throw new Error("Gemini 500");
        return batch.map((b) => ({ id: b.alias, score: 80, reason: "ai" }));
      },
      fallback: () => ({ score: 10, reason: "rule" }),
    });
    const basic = [...scores.values()].filter((s) => s.basic).length;
    expect(basic).toBe(40);
  });
  it("stops starting new chunks after the deadline (the rest get rule-based scores)", async () => {
    let t = 0;
    const { calls, scores } = await scoreInChunks({
      items: people,
      key: (p) => p.id,
      chunkSize: 40,
      parallel: 1,
      deadline: 1,
      now: () => t++,
      aliasPrefix: "u",
      call: async (batch) => batch.map((b) => ({ id: b.alias, score: 90, reason: "ai" })),
      fallback: () => ({ score: 5, reason: "rule" }),
    });
    expect(calls).toBe(1);
    expect(scores.size).toBe(95);
  });
  it("ignores ids the model invents and clamps scores", async () => {
    const { scores } = await scoreInChunks({
      items: people.slice(0, 3),
      key: (p) => p.id,
      chunkSize: 40,
      parallel: 1,
      deadline: Date.now() + 1000,
      aliasPrefix: "u",
      call: async () => [
        { id: "u1", score: 140, reason: "x" },
        { id: "u99", score: 90, reason: "ghost" },
      ],
      fallback: () => ({ score: 3, reason: "rule" }),
    });
    expect(scores.get("m0")?.score).toBe(100);
    expect(scores.get("m1")?.basic).toBe(true);
    expect(scores.size).toBe(3);
  });
});
