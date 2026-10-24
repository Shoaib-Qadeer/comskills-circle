import { describe, it, expect } from "vitest";
import { ObjectId } from "mongodb";
import { announcementDTO, announcementInputSchema, isPinnedNow, sortFeed } from "../src/lib/news";
import type { AnnouncementDoc } from "../src/lib/types";

const NOW = new Date("2026-10-24T06:00:00Z");
const at = (h: number) => new Date(NOW.getTime() + h * 3600e3);
function post(over: Partial<AnnouncementDoc> = {}): AnnouncementDoc {
  return {
    _id: new ObjectId(), authorId: new ObjectId(), title: "Hello", body: "Body text", category: "programme", link: null,
    pinned: false, pinnedUntil: null, reactionCounts: { "👍": 0, "🎉": 0, "❤️": 0, "👏": 0 } as never, emailedAt: null, emailedCount: 0,
    scholarshipId: null, createdAt: at(-1), editedAt: null, ...over,
  };
}

describe("news feed order", () => {
  it("pinned posts stay on top, newest first within each group", () => {
    const oldPinned = post({ title: "old pinned", pinned: true, createdAt: at(-100) });
    const newPinned = post({ title: "new pinned", pinned: true, createdAt: at(-50) });
    const latest = post({ title: "latest", createdAt: at(-1) });
    const older = post({ title: "older", createdAt: at(-10) });
    expect(sortFeed([older, oldPinned, latest, newPinned], NOW).map((p) => p.title)).toEqual(["new pinned", "old pinned", "latest", "older"]);
  });
  it("a pin ends after its 'pin until' day", () => {
    const until = new Date(Date.UTC(2026, 9, 23)); // yesterday (date-only)
    expect(isPinnedNow({ pinned: true, pinnedUntil: until }, NOW)).toBe(false);
    expect(isPinnedNow({ pinned: true, pinnedUntil: new Date(Date.UTC(2026, 9, 24)) }, NOW)).toBe(true);
    expect(isPinnedNow({ pinned: true, pinnedUntil: null }, NOW)).toBe(true);
    expect(isPinnedNow({ pinned: false, pinnedUntil: null }, NOW)).toBe(false);
    const expired = post({ title: "expired pin", pinned: true, pinnedUntil: until, createdAt: at(-200) });
    expect(sortFeed([expired, post({ title: "normal" })], NOW)[0].title).toBe("normal");
  });
});

describe("announcement DTO", () => {
  const viewer = { _id: new ObjectId(), isAdmin: false, seenAt: at(-5) };
  it("only author or admin can edit; 'new' means unseen and not your own", () => {
    const p = post({ createdAt: at(-1) });
    const d = announcementDTO(p, viewer, { authors: new Map(), mine: [] });
    expect(d.canEdit).toBe(false);
    expect(d.isNew).toBe(true);
    expect(announcementDTO(post({ createdAt: at(-10) }), viewer, { authors: new Map(), mine: [] }).isNew).toBe(false);
    const own = announcementDTO(post({ authorId: viewer._id }), viewer, { authors: new Map(), mine: [] });
    expect(own.canEdit && !own.isNew).toBe(true);
    expect(announcementDTO(p, { ...viewer, isAdmin: true }, { authors: new Map(), mine: [] }).canEdit).toBe(true);
  });
  it("never shows negative reaction counts or unsafe links", () => {
    const d = announcementDTO(post({ reactionCounts: { "👍": -2 } as never, link: "javascript:alert(1)" }), viewer, { authors: new Map(), mine: [] });
    expect(d.reactions["👍"]).toBe(0);
    expect(d.link).toBeNull();
  });
  it("rejects non-http links when posting", () => {
    expect(announcementInputSchema.safeParse({ title: "Hi there", body: "Text here", category: "event", link: "ftp://x.y" }).success).toBe(false);
    expect(announcementInputSchema.safeParse({ title: "Hi there", body: "Text here", category: "event", link: "https://x.y" }).success).toBe(true);
  });
});
