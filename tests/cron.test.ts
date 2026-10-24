import { describe, it, expect } from "vitest";
import { assembleDigest, digestDue, remindersDue } from "../src/lib/cron";
import { DEFAULT_NOTIFY } from "../src/lib/types";

const TZ = "Asia/Karachi";
// Monday 26 Oct 2026, 09:00 Karachi
const MON = new Date("2026-10-26T04:00:00Z");
const TUE = new Date("2026-10-27T04:00:00Z");
const created = new Date("2026-09-01T00:00:00Z");
const u = (digest: "weekly" | "daily" | "off", lastDigestAt: Date | null) => ({ notify: { ...DEFAULT_NOTIFY, digest }, lastDigestAt, createdAt: created });

describe("digestDue", () => {
  it("weekly members get it on the chosen weekday, once", () => {
    expect(digestDue(u("weekly", new Date("2026-10-19T04:00:00Z")), 1, MON, TZ)).toBe(true);
    expect(digestDue(u("weekly", new Date("2026-10-19T04:00:00Z")), 3, MON, TZ)).toBe(false);
    expect(digestDue(u("weekly", MON), 1, new Date("2026-10-26T15:00:00Z"), TZ)).toBe(false);
  });
  it("someone skipped on the weekday (budget) gets it the next day", () => {
    expect(digestDue(u("weekly", new Date("2026-10-19T04:00:00Z")), 1, TUE, TZ)).toBe(true);
    expect(digestDue(u("weekly", MON), 1, TUE, TZ)).toBe(false);
  });
  it("daily once a day; off never", () => {
    expect(digestDue(u("daily", new Date("2026-10-25T04:00:00Z")), 1, TUE, TZ)).toBe(true);
    expect(digestDue(u("daily", new Date("2026-10-27T01:00:00Z")), 1, TUE, TZ)).toBe(false);
    expect(digestDue(u("off", null), 1, MON, TZ)).toBe(false);
  });
});

describe("deadline reminders", () => {
  const d = (n: number) => new Date(Date.UTC(2026, 9, 26 + n));
  it("7 days, then 1 day, each once", () => {
    expect(remindersDue({ stage: "applying", deadline: d(7), remindersSent: [] }, MON, TZ)).toEqual([7]);
    expect(remindersDue({ stage: "applying", deadline: d(5), remindersSent: [7] }, MON, TZ)).toEqual([]);
    expect(remindersDue({ stage: "applying", deadline: d(1), remindersSent: [7] }, MON, TZ)).toEqual([1]);
    expect(remindersDue({ stage: "applying", deadline: d(0), remindersSent: [7, 1] }, MON, TZ)).toEqual([]);
  });
  it("a missed cron day still sends the reminder; nothing for past, far or non-applying", () => {
    expect(remindersDue({ stage: "applying", deadline: d(6), remindersSent: [] }, MON, TZ)).toEqual([7]);
    expect(remindersDue({ stage: "applying", deadline: d(-1), remindersSent: [] }, MON, TZ)).toEqual([]);
    expect(remindersDue({ stage: "applying", deadline: d(20), remindersSent: [] }, MON, TZ)).toEqual([]);
    expect(remindersDue({ stage: "applied", deadline: d(1), remindersSent: [] }, MON, TZ)).toEqual([]);
  });
});

describe("assembleDigest", () => {
  it("is empty when nothing is new (so the member is skipped)", () => {
    expect(assembleDigest({ notifications: [], proposalMatches: [], opportunityMatches: [], announcements: [], deadlines: [] }, MON, TZ)).toEqual([]);
  });
  it("caps lists at 5 and adds a 'more' line", () => {
    const n = Array.from({ length: 8 }, (_, i) => ({ kind: "interest", text: `Update ${i}`, href: "/projects" }));
    const s = assembleDigest({ notifications: n, proposalMatches: [], opportunityMatches: [], announcements: [], deadlines: [] }, MON, TZ);
    expect(s[0].items).toHaveLength(6);
    expect(s[0].items[5].title).toBe("…and 3 more updates");
  });
  it("never puts email addresses in the digest", () => {
    const s = assembleDigest(
      { notifications: [], proposalMatches: [{ id: "p", title: "Crop genomes", reason: "Your Python fits." }], opportunityMatches: [], announcements: [{ id: "a", title: "Orientation" }], deadlines: [{ name: "DAAD", deadline: new Date(Date.UTC(2026, 9, 27)) }] },
      MON,
      TZ,
    );
    expect(s.map((x) => x.heading)).toEqual(["New projects that fit you", "Your deadlines this week", "News from the Comskills team"]);
    expect(s[1].items[0].detail).toBe("due in 1 day");
    expect(JSON.stringify(s)).not.toMatch(/@/);
  });
});
