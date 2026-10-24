import { z } from "zod";
import type { ObjectId } from "mongodb";
import { collections } from "./db";
import { ACTIVE_MEMBER } from "./access";
import { isHttpUrl } from "./url";
import { dateFromKey } from "./time";
import { getSettings } from "./settings";
import { appUrl, sendEmail, unsubscribeUrl } from "./mail";
import { notificationEmail } from "./mail-templates";
import { shouldEmailInstant } from "./notify";
import { REACTIONS, type AnnouncementCategory, type AnnouncementDoc, type MiniUserDTO, type Reaction, type UserDoc } from "./types";

export const CATEGORIES: { value: AnnouncementCategory; label: string; emoji: string }[] = [
  { value: "programme", label: "Programme", emoji: "📌" },
  { value: "event", label: "Event", emoji: "📅" },
  { value: "deadline", label: "Deadline", emoji: "⏳" },
  { value: "opportunity", label: "Opportunity", emoji: "🎯" },
  { value: "win", label: "Win", emoji: "🎉" },
];

export const announcementInputSchema = z.object({
  title: z.string().trim().min(3, "Add a title").max(120),
  body: z.string().trim().min(3, "Write a few words").max(3000),
  category: z.enum(["programme", "event", "deadline", "opportunity", "win"]),
  link: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || isHttpUrl(v), "The link should start with https://"),
  pinned: z.boolean().default(false),
  pinnedUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  emailEveryone: z.boolean().default(false),
  scholarshipId: z.string().nullable().optional(),
});
export const announcementPatchSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    body: z.string().trim().min(3).max(3000),
    category: z.enum(["programme", "event", "deadline", "opportunity", "win"]),
    link: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .refine((v) => !v || isHttpUrl(v), "The link should start with https://"),
    pinned: z.boolean(),
    pinnedUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  })
  .partial();

export const emptyReactions = (): Record<Reaction, number> => Object.fromEntries(REACTIONS.map((r) => [r, 0])) as Record<Reaction, number>;

/** Pinned posts stay on top until unpinned or until the end of their "pin until" day. */
export function isPinnedNow(a: Pick<AnnouncementDoc, "pinned" | "pinnedUntil">, now: Date = new Date()): boolean {
  if (!a.pinned) return false;
  if (!a.pinnedUntil) return true;
  return now.getTime() < a.pinnedUntil.getTime() + 86_400_000;
}

/** Pinned first (newest pinned first), then everything else newest first. */
export function sortFeed<T extends Pick<AnnouncementDoc, "pinned" | "pinnedUntil" | "createdAt">>(items: T[], now: Date = new Date()): T[] {
  return [...items].sort((a, b) => Number(isPinnedNow(b, now)) - Number(isPinnedNow(a, now)) || b.createdAt.getTime() - a.createdAt.getTime());
}

export function pinnedUntilDate(key: string | null): Date | null {
  return key ? dateFromKey(key) : null;
}

export interface AnnouncementDTO {
  id: string;
  author: (MiniUserDTO & { teamTitle: string | null }) | null;
  title: string;
  body: string;
  category: AnnouncementCategory;
  link: string | null;
  pinned: boolean;
  pinnedUntil: string | null;
  reactions: Record<Reaction, number>;
  mine: Reaction[];
  emailedAt: string | null;
  emailedCount: number;
  canEdit: boolean;
  isNew: boolean;
  createdAt: string;
  editedAt: string | null;
}

export function announcementDTO(
  a: AnnouncementDoc,
  viewer: Pick<UserDoc, "_id" | "isAdmin"> & { seenAt: Date | null },
  ctx: { authors: Map<string, MiniUserDTO & { teamTitle: string | null }>; mine: Reaction[] },
): AnnouncementDTO {
  const own = Boolean(a.authorId && String(a.authorId) === String(viewer._id));
  const reactions = { ...emptyReactions(), ...(a.reactionCounts || {}) };
  for (const r of REACTIONS) reactions[r] = Math.max(0, reactions[r] || 0);
  return {
    id: String(a._id),
    author: a.authorId ? ctx.authors.get(String(a.authorId)) ?? null : null,
    title: a.title,
    body: a.body,
    category: a.category,
    link: isHttpUrl(a.link) ? a.link : null,
    pinned: isPinnedNow(a),
    pinnedUntil: a.pinnedUntil ? a.pinnedUntil.toISOString().slice(0, 10) : null,
    reactions,
    mine: ctx.mine,
    emailedAt: a.emailedAt ? a.emailedAt.toISOString() : null,
    emailedCount: a.emailedCount ?? 0,
    canEdit: own || viewer.isAdmin,
    isNew: !own && (!viewer.seenAt || a.createdAt > viewer.seenAt),
    createdAt: a.createdAt.toISOString(),
    editedAt: a.editedAt ? a.editedAt.toISOString() : null,
  };
}

/**
 * Emails a post to every member (except the author), one message each, respecting the daily budget
 * (it stops before the code reserve), each member's "important announcements" switch, and a time
 * limit so the function finishes on Vercel Hobby. Members it doesn't reach still see the post in
 * the app and in their next digest.
 */
export async function broadcastAnnouncement(a: AnnouncementDoc, timeBudgetMs = 50_000): Promise<{ sent: number; skipped: number; stoppedBy: "budget" | "time" | null }> {
  const started = Date.now();
  const settings = await getSettings();
  const { users, announcements } = await collections();
  const people = await users
    .find({ ...ACTIVE_MEMBER, ...(a.authorId ? { _id: { $ne: a.authorId } } : {}) }, { projection: { email: 1, name: 1, notify: 1 } })
    .toArray();
  let sent = 0;
  let skipped = 0;
  let stoppedBy: "budget" | "time" | null = null;
  const firstPara = a.body.split(/\n\s*\n/)[0].slice(0, 600);
  for (const u of people) {
    if (Date.now() - started > timeBudgetMs) {
      stoppedBy = "time";
      break;
    }
    if (!shouldEmailInstant("announcement", u.notify, settings.email)) {
      skipped++;
      continue;
    }
    const unsub = unsubscribeUrl(u._id);
    const r = await sendEmail({
      to: u.email,
      userId: u._id,
      kind: "announcement",
      unsubscribeUrl: unsub,
      message: notificationEmail({
        subject: a.title,
        heading: a.title,
        lines: firstPara.split("\n").filter(Boolean),
        cta: { label: "Read it on Comskills Circle", url: appUrl(`/news#a-${String(a._id)}`) },
        reason: "You got this because the Comskills team chose to email this announcement to all members.",
        unsubscribeUrl: unsub,
      }),
    });
    if (r.ok) sent++;
    else if (r.reason === "budget") {
      stoppedBy = "budget";
      break;
    } else skipped++;
  }
  await announcements.updateOne({ _id: a._id }, { $set: { emailedAt: new Date(), emailedCount: sent } });
  return { sent, skipped, stoppedBy };
}

/** Loads authors (with team titles) for a set of posts. */
export async function loadAuthors(ids: (ObjectId | null)[]) {
  const { users } = await collections();
  const { photoUrlFor } = await import("./serialize");
  const uniq = Array.from(new Set(ids.filter(Boolean).map(String)));
  const { ObjectId } = await import("mongodb");
  const docs = uniq.length
    ? await users.find({ _id: { $in: uniq.map((x) => new ObjectId(x)) } }, { projection: { name: 1, hasPhoto: 1, photoVersion: 1, teamTitle: 1, role: 1 } }).toArray()
    : [];
  return new Map(docs.map((u) => [String(u._id), { id: String(u._id), name: u.name, photoUrl: photoUrlFor(u), teamTitle: u.role === "team" ? u.teamTitle ?? null : null }]));
}
