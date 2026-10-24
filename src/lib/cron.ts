import type { ObjectId } from "mongodb";
import { collections } from "./db";
import { ACTIVE_MEMBER } from "./access";
import { getSettings, type AppSettings } from "./settings";
import { appUrl, sendEmail, unsubscribeUrl } from "./mail";
import { digestEmail, nudgeEmail, type DigestSection } from "./mail-templates";
import { daysUntil, localDayKey, localDayOfMonth, localWeekday } from "./time";
import { notify } from "./notify";
import { deleteUserCascade } from "./users";
import { todayStored } from "./opportunities";
import { DEFAULT_NOTIFY, type ScholarshipDoc, type UserDoc } from "./types";

const DAY = 86_400_000;
/** Stop starting new work after this long, so the function ends inside Vercel Hobby's 60 s. */
export const CRON_TIME_BUDGET_MS = 48_000;
/** Unverified sign-ups are removed after this many days. */
export const UNVERIFIED_TTL_DAYS = 7;

/* ------------------------------------------------------------------ pure rules (tested) */

/**
 * Is a digest due for this member today?
 * - off: never
 * - daily: once per local day
 * - weekly: on the admin-chosen weekday, or when the last one is 8+ days old
 *   (someone the budget or time limit skipped last time gets it the next day)
 */
export function digestDue(
  u: Pick<UserDoc, "notify" | "lastDigestAt" | "createdAt">,
  weekday: number,
  now: Date = new Date(),
  tz?: string,
): boolean {
  const freq = (u.notify ?? DEFAULT_NOTIFY).digest;
  if (freq === "off") return false;
  const today = localDayKey(now, tz);
  if (u.lastDigestAt && localDayKey(u.lastDigestAt, tz) === today) return false;
  if (freq === "daily") return true;
  if (localWeekday(now, tz) === weekday) return true;
  const since = u.lastDigestAt ?? u.createdAt;
  return now.getTime() - since.getTime() >= 8 * DAY;
}

/** Which deadline reminders (7 days, 1 day) an Applying entry should get now. */
export function remindersDue(e: Pick<ScholarshipDoc, "stage" | "deadline" | "remindersSent">, now: Date = new Date(), tz?: string): (7 | 1)[] {
  if (e.stage !== "applying" || !e.deadline) return [];
  const n = daysUntil(e.deadline, now, tz);
  const sent = e.remindersSent ?? [];
  if (n < 0) return [];
  if (n <= 1) return sent.includes(1) ? [] : [1];
  if (n <= 7) return sent.includes(7) ? [] : [7];
  return [];
}

export type DigestInput = {
  notifications: { kind: string; text: string; href: string }[];
  proposalMatches: { title: string; reason: string; id: string }[];
  opportunityMatches: { title: string; reason: string; id: string; deadline: Date | null }[];
  announcements: { title: string; id: string }[];
  deadlines: { name: string; deadline: Date }[];
};

/** Turns what's new for a member into email sections (max 5 items each). Empty = skip them. */
export function assembleDigest(d: DigestInput, now: Date = new Date(), tz?: string): DigestSection[] {
  const sections: DigestSection[] = [];
  const cap = <T,>(a: T[]) => a.slice(0, 5);
  const more = (n: number, label: string) => (n > 5 ? [{ title: `…and ${n - 5} more ${label}`, url: appUrl("/inbox") }] : []);
  if (d.notifications.length)
    sections.push({
      heading: "Your projects and invites",
      items: [...cap(d.notifications).map((n) => ({ title: n.text, url: appUrl(n.href) })), ...more(d.notifications.length, "updates")],
    });
  if (d.proposalMatches.length)
    sections.push({
      heading: "New projects that fit you",
      items: cap(d.proposalMatches).map((m) => ({ title: m.title, detail: m.reason, url: appUrl(`/projects/${m.id}`) })),
    });
  if (d.opportunityMatches.length)
    sections.push({
      heading: "New opportunities for you",
      items: cap(d.opportunityMatches).map((m) => ({
        title: m.title,
        detail: [m.reason, m.deadline ? `deadline in ${daysUntil(m.deadline, now, tz)} days` : null].filter(Boolean).join(" · "),
        url: appUrl(`/opportunities?open=${m.id}`),
      })),
    });
  if (d.deadlines.length)
    sections.push({
      heading: "Your deadlines this week",
      items: d.deadlines.map((x) => {
        const n = daysUntil(x.deadline, now, tz);
        return { title: x.name, detail: n === 0 ? "due today" : `due in ${n} day${n === 1 ? "" : "s"}`, url: appUrl("/scholarships") };
      }),
    });
  if (d.announcements.length)
    sections.push({ heading: "News from the Comskills team", items: cap(d.announcements).map((a) => ({ title: a.title, url: appUrl(`/news#a-${a.id}`) })) });
  return sections;
}

/* ------------------------------------------------------------------ data */

const DIGEST_NOTIFICATION_KINDS = ["interest", "projectStatus", "invite", "memberAccepted", "deadline"];

async function digestInputFor(u: Pick<UserDoc, "_id" | "createdAt" | "lastDigestAt">, now: Date): Promise<DigestInput> {
  const since = u.lastDigestAt ?? new Date(Math.max(u.createdAt.getTime(), now.getTime() - 7 * DAY));
  const c = await collections();
  const today = todayStored(now);
  const [notifs, ms, news, deadlines] = await Promise.all([
    c.notifications.find({ userId: u._id, read: false, createdAt: { $gt: since }, kind: { $in: DIGEST_NOTIFICATION_KINDS } }).sort({ createdAt: -1 }).limit(20).toArray(),
    c.matches.find({ userId: u._id, dismissed: false, createdAt: { $gt: since } }).sort({ score: -1 }).limit(30).toArray(),
    c.announcements.find({ createdAt: { $gt: since }, authorId: { $ne: u._id } }).sort({ createdAt: -1 }).limit(10).toArray(),
    c.scholarships.find({ userId: u._id, stage: "applying", deadline: { $gte: today, $lte: new Date(today.getTime() + 7 * DAY) } }).sort({ deadline: 1 }).limit(5).toArray(),
  ]);
  const propIds = ms.filter((m) => m.kind === "proposal").map((m) => m.targetId);
  const oppIds = ms.filter((m) => m.kind === "opportunity").map((m) => m.targetId);
  const [props, opps] = await Promise.all([
    propIds.length ? c.proposals.find({ _id: { $in: propIds }, status: { $ne: "completed" } }, { projection: { title: 1 } }).toArray() : [],
    oppIds.length ? c.opportunities.find({ _id: { $in: oppIds }, $or: [{ deadline: null }, { deadline: { $gte: today } }] }, { projection: { title: 1, deadline: 1 } }).toArray() : [],
  ]);
  const pBy = new Map(props.map((p) => [String(p._id), p]));
  const oBy = new Map(opps.map((o) => [String(o._id), o]));
  return {
    notifications: notifs.map((n) => ({ kind: n.kind, text: n.text, href: n.href })),
    proposalMatches: ms.filter((m) => m.kind === "proposal" && pBy.has(String(m.targetId))).map((m) => ({ id: String(m.targetId), title: pBy.get(String(m.targetId))!.title, reason: m.reason })),
    opportunityMatches: ms
      .filter((m) => m.kind === "opportunity" && oBy.has(String(m.targetId)))
      .map((m) => ({ id: String(m.targetId), title: oBy.get(String(m.targetId))!.title, reason: m.reason, deadline: oBy.get(String(m.targetId))!.deadline })),
    // Pinned + emailed posts already reached people; the digest carries the rest
    announcements: news.filter((a) => !(a.pinned && a.emailedAt)).map((a) => ({ id: String(a._id), title: a.title })),
    deadlines: deadlines.filter((d) => d.deadline).map((d) => ({ name: d.name, deadline: d.deadline! })),
  };
}

/* ------------------------------------------------------------------ the daily run */

export type CronReport = {
  day: string;
  dryRun: boolean;
  digests: { due: number; sent: number; empty: number; failed: number; preview: { member: string; sections: string[] }[] };
  reminders: { sent: number };
  nudge: { ran: boolean; sent: number };
  cleanup: { unverifiedRemoved: number; pinsExpired: number };
  stoppedBy: "budget" | "time" | null;
  ms: number;
};

type CronState = { _id: "cron"; lastNudgeMonth?: string; lastRunAt?: Date; lastReport?: CronReport };

async function cronState() {
  const db = (await collections()).users.db;
  return db.collection<CronState>("settings");
}

export async function lastCronReport(): Promise<CronReport | null> {
  const doc = await (await cronState()).findOne({ _id: "cron" });
  return doc?.lastReport ?? null;
}

/**
 * Runs once a day from Vercel Cron (~09:00 Karachi): deadline reminders, cleanup, digests and the
 * monthly nudge. Respects the Gmail budget and a time limit; anyone skipped is first in line tomorrow.
 * `dryRun` sends nothing and changes nothing; it reports who would get what (first 20 previews).
 */
export async function runDaily(opts: { dryRun?: boolean; now?: Date } = {}): Promise<CronReport> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const dryRun = Boolean(opts.dryRun);
  const settings = await getSettings(true);
  const c = await collections();
  const outOfTime = () => Date.now() - started > CRON_TIME_BUDGET_MS;
  const report: CronReport = {
    day: localDayKey(now),
    dryRun,
    digests: { due: 0, sent: 0, empty: 0, failed: 0, preview: [] },
    reminders: { sent: 0 },
    nudge: { ran: false, sent: 0 },
    cleanup: { unverifiedRemoved: 0, pinsExpired: 0 },
    stoppedBy: null,
    ms: 0,
  };

  // 1. Deadline reminders (in-app; they also appear in the digest)
  const today = todayStored(now);
  const soon = await c.scholarships.find({ stage: "applying", deadline: { $gte: today, $lte: new Date(today.getTime() + 7 * DAY) } }).toArray();
  for (const e of soon) {
    const due = remindersDue(e, now);
    if (!due.length) continue;
    report.reminders.sent++;
    if (dryRun) continue;
    const n = daysUntil(e.deadline!, now);
    await notify([e.userId], { kind: "deadline", text: `⏳ ${e.name}: deadline ${n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`}`, href: "/scholarships" });
    await c.scholarships.updateOne({ _id: e._id }, { $addToSet: { remindersSent: { $each: due } } });
  }

  // 2. Cleanup
  if (!dryRun) {
    const stale = await c.users.find({ emailVerifiedAt: null, createdAt: { $lt: new Date(now.getTime() - UNVERIFIED_TTL_DAYS * DAY) } }, { projection: { _id: 1 } }).limit(200).toArray();
    for (const u of stale) await deleteUserCascade(u._id);
    report.cleanup.unverifiedRemoved = stale.length;
    const r = await c.announcements.updateMany({ pinned: true, pinnedUntil: { $ne: null, $lt: today } }, { $set: { pinned: false } });
    report.cleanup.pinsExpired = r.modifiedCount;
  }

  // 3. Digests (oldest digest first, so anyone skipped last time goes first)
  if (settings.email.digestEnabled) {
    const members = await c.users
      .find({ ...ACTIVE_MEMBER, "notify.digest": { $ne: "off" } }, { projection: { email: 1, name: 1, notify: 1, lastDigestAt: 1, createdAt: 1 } })
      .sort({ lastDigestAt: 1, _id: 1 })
      .toArray();
    for (const u of members) {
      if (!digestDue(u, settings.email.digestWeekday, now)) continue;
      report.digests.due++;
      if (outOfTime()) {
        report.stoppedBy = "time";
        break;
      }
      const sections = assembleDigest(await digestInputFor(u, now), now);
      if (dryRun) {
        if (!sections.length) report.digests.empty++;
        else if (report.digests.preview.length < 20) report.digests.preview.push({ member: u.name, sections: sections.map((s) => `${s.heading} (${s.items.length})`) });
        continue;
      }
      if (!sections.length) {
        report.digests.empty++;
        await c.users.updateOne({ _id: u._id }, { $set: { lastDigestAt: now } });
        continue;
      }
      const unsub = unsubscribeUrl(u._id);
      const freq = (u.notify ?? DEFAULT_NOTIFY).digest === "daily" ? "daily" : "weekly";
      const res = await sendEmail({ to: u.email, userId: u._id, kind: "digest", unsubscribeUrl: unsub, message: digestEmail({ name: u.name, frequency: freq, sections, url: appUrl("/projects"), unsubscribeUrl: unsub }) });
      if (res.ok) {
        report.digests.sent++;
        await c.users.updateOne({ _id: u._id }, { $set: { lastDigestAt: now } });
      } else if (res.reason === "budget") {
        report.stoppedBy = "budget";
        break;
      } else report.digests.failed++;
    }
  }

  // 4. Monthly nudge on the 1st (once per month)
  const month = report.day.slice(0, 7);
  const state = await cronState();
  const st = await state.findOne({ _id: "cron" });
  if (settings.email.monthlyNudge && localDayOfMonth(now) === 1 && st?.lastNudgeMonth !== month && !report.stoppedBy) {
    report.nudge.ran = true;
    if (!dryRun) {
      await state.updateOne({ _id: "cron" }, { $set: { lastNudgeMonth: month } }, { upsert: true });
      const people = await c.users.find({ ...ACTIVE_MEMBER, "notify.digest": { $ne: "off" } }, { projection: { email: 1, name: 1 } }).toArray();
      for (const u of people) {
        if (outOfTime()) {
          report.stoppedBy = "time";
          break;
        }
        const unsub = unsubscribeUrl(u._id);
        const r = await sendEmail({ to: u.email, userId: u._id, kind: "nudge", unsubscribeUrl: unsub, message: nudgeEmail({ name: u.name, url: appUrl("/scholarships"), unsubscribeUrl: unsub }) });
        if (r.ok) report.nudge.sent++;
        else if (r.reason === "budget") {
          report.stoppedBy = "budget";
          break;
        }
      }
    }
  }

  report.ms = Date.now() - started;
  if (!dryRun) await state.updateOne({ _id: "cron" }, { $set: { lastRunAt: now, lastReport: report } }, { upsert: true });
  return report;
}

/** Unsubscribe from everything except account emails (codes, approval). */
export async function unsubscribeAll(userId: ObjectId) {
  const { users } = await collections();
  await users.updateOne(
    { _id: userId },
    { $set: { "notify.digest": "off", "notify.instant": { interest: false, teamUpdates: false, connect: false, pinned: false, invites: false }, updatedAt: new Date() } },
  );
}

export type { AppSettings };
