import { after } from "next/server";
import type { ObjectId } from "mongodb";
import { collections } from "./db";
import { getSettings, type AppSettings, type InstantKind } from "./settings";
import { appUrl, sendEmail, unsubscribeUrl, type MailKind } from "./mail";
import { notificationEmail } from "./mail-templates";
import { DEFAULT_NOTIFY, type NotifyPrefs } from "./types";

export type NotifyKind =
  | "interest"
  | "memberAccepted"
  | "memberDeclined"
  | "memberRemoved"
  | "memberLeft"
  | "projectStatus"
  | "invite"
  | "connectRequest"
  | "connectAccepted"
  | "announcement"
  | "deadline"
  | "system";

/** Which instant-email switch governs each kind (kinds not listed never send an instant email). */
const INSTANT_FOR: Partial<Record<NotifyKind, InstantKind>> = {
  interest: "interest",
  memberAccepted: "teamUpdates",
  projectStatus: "teamUpdates",
  invite: "invites",
  connectRequest: "connect",
  connectAccepted: "connect",
  announcement: "pinned",
};

const MAIL_KIND: Partial<Record<NotifyKind, MailKind>> = {
  interest: "interest",
  memberAccepted: "memberStatus",
  projectStatus: "projectStatus",
  invite: "invite",
  connectRequest: "connect",
  connectAccepted: "connect",
  announcement: "announcement",
};

/** Pure: does this kind go out as an instant email to this member right now? */
export function shouldEmailInstant(kind: NotifyKind, member: NotifyPrefs | undefined, admin: AppSettings["email"]): boolean {
  const k = INSTANT_FOR[kind];
  if (!k) return false;
  if (!admin.instant[k]) return false;
  return (member ?? DEFAULT_NOTIFY).instant[k] !== false;
}

export type NotifyEmail = { subject: string; heading: string; lines: string[]; quote?: string | null; cta: string };

/** Runs work after the response when inside a request; otherwise just starts it. */
export function later(fn: () => Promise<unknown>) {
  try {
    after(fn);
  } catch {
    void fn().catch((e) => console.error("[later]", e));
  }
}

/**
 * Adds an in-app notification for each person and, if `email` is given and the kind allows it,
 * sends instant emails after the response (respecting admin and member switches and the budget).
 */
export async function notify(userIds: ObjectId[], n: { kind: NotifyKind; text: string; href: string; email?: NotifyEmail }) {
  const ids = Array.from(new Map(userIds.map((id) => [String(id), id])).values());
  if (!ids.length) return;
  const { notifications } = await collections();
  const now = new Date();
  await notifications.insertMany(ids.map((userId) => ({ userId, kind: n.kind, text: n.text.slice(0, 300), href: n.href, read: false, createdAt: now })) as never);
  if (n.email && INSTANT_FOR[n.kind]) later(() => sendInstantEmails(ids, n.kind, n.href, n.email!));
}

async function sendInstantEmails(ids: ObjectId[], kind: NotifyKind, href: string, e: NotifyEmail) {
  const settings = await getSettings();
  const { users } = await collections();
  const people = await users
    .find({ _id: { $in: ids }, status: "approved", emailVerifiedAt: { $ne: null } }, { projection: { email: 1, name: 1, notify: 1 } })
    .toArray();
  for (const u of people) {
    if (!shouldEmailInstant(kind, u.notify, settings.email)) continue;
    const unsub = unsubscribeUrl(u._id);
    const message = notificationEmail({
      subject: e.subject,
      heading: e.heading,
      lines: e.lines,
      quote: e.quote,
      cta: { label: e.cta, url: appUrl(href) },
      reason: "You got this because of your Comskills Circle notification settings.",
      unsubscribeUrl: unsub,
    });
    const r = await sendEmail({ to: u.email, userId: u._id, kind: MAIL_KIND[kind] ?? "announcement", message, unsubscribeUrl: unsub });
    if (!r.ok && r.reason === "budget") break; // budget reached: the in-app notification is still there
  }
}
