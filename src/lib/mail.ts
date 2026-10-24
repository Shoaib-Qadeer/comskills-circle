import nodemailer, { type Transporter } from "nodemailer";
import type { ObjectId } from "mongodb";
import { collections } from "./db";
import { getSettings, type AppSettings } from "./settings";
import { localDayKey } from "./time";
import { signValue } from "./codes";
import type { Rendered } from "./mail-templates";

/**
 * Gmail SMTP sending with a daily budget. Consumer Gmail allows roughly 500 recipients a day, so:
 *  - every recipient is counted in usage.emailsSent (per day in the app time zone);
 *  - normal mail (notifications, digests, broadcasts) stops at dailyLimit − reserveForCodes;
 *  - sign-up and password-reset codes may use the reserve, up to dailyLimit.
 */

export type MailKind =
  | "code"
  | "approved"
  | "signupAlert"
  | "interest"
  | "memberStatus"
  | "projectStatus"
  | "invite"
  | "connect"
  | "announcement"
  | "digest"
  | "nudge"
  | "test";

export type SendResult = { ok: true; dev?: boolean } | { ok: false; reason: "budget" | "not_configured" | "error"; error?: string };

export function mailConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

export function appUrl(path = ""): string {
  const base =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}${path}`;
}

export function unsubscribeUrl(userId: ObjectId | string): string {
  const id = String(userId);
  return appUrl(`/unsubscribe?u=${id}&s=${signValue(id)}`);
}

/** The most recipients a kind of email may bring today's count up to. */
export function emailCap(kind: MailKind, email: AppSettings["email"]): number {
  return kind === "code" ? email.dailyLimit : Math.max(0, email.dailyLimit - email.reserveForCodes);
}

/** Pure check used by the budget and by tests: may one more email of this kind be sent? */
export function budgetAllows(kind: MailKind, sentSoFar: number, email: AppSettings["email"]): boolean {
  return sentSoFar < emailCap(kind, email);
}

/** Removes anything that looks like an email address from error text before it is logged. */
export function scrubAddresses(s: string): string {
  return s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[address]");
}

const g = globalThis as unknown as { _mailer?: Transporter };
function transporter(): Transporter {
  if (!g._mailer) {
    g._mailer = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: process.env.GMAIL_USER, pass: (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "") },
      pool: true,
      maxConnections: 2,
      maxMessages: 100,
      // about 5 messages a second
      rateDelta: 1000,
      rateLimit: 5,
    });
  }
  return g._mailer;
}

async function reserve(kind: MailKind): Promise<boolean> {
  const settings = await getSettings();
  const cap = emailCap(kind, settings.email);
  const { usage } = await collections();
  const day = localDayKey();
  await usage.updateOne({ _id: day }, { $setOnInsert: { llmCalls: 0 } }, { upsert: true });
  const doc = await usage.findOneAndUpdate(
    { _id: day, $or: [{ emailsSent: { $lt: cap } }, { emailsSent: { $exists: false } }] },
    { $inc: { emailsSent: 1 } },
    { returnDocument: "after" },
  );
  return Boolean(doc);
}

async function release() {
  const { usage } = await collections();
  await usage.updateOne({ _id: localDayKey(), emailsSent: { $gt: 0 } }, { $inc: { emailsSent: -1 } });
}

async function log(kind: MailKind, userId: ObjectId | null, ok: boolean, error: string | null) {
  try {
    const { emailLog } = await collections();
    await emailLog.insertOne({ at: new Date(), kind, userId, ok, error: error ? scrubAddresses(error).slice(0, 300) : null });
  } catch (e) {
    console.error("[mail] could not write the email log", e instanceof Error ? e.message : e);
  }
}

/** Sends one email to one recipient. Never throws; the result says what happened. */
export async function sendEmail(opts: {
  to: string;
  userId?: ObjectId | null;
  kind: MailKind;
  message: Rendered;
  unsubscribeUrl?: string;
}): Promise<SendResult> {
  const userId = opts.userId ?? null;
  if (!mailConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      // Local development without Gmail: print the email so codes can still be used.
      console.info(`\n[mail:dev] ${opts.kind} → ${opts.to}\nSubject: ${opts.message.subject}\n${opts.message.text}\n`);
      await log(opts.kind, userId, true, "dev: printed to the server console");
      return { ok: true, dev: true };
    }
    await log(opts.kind, userId, false, "Gmail is not configured (GMAIL_USER / GMAIL_APP_PASSWORD)");
    return { ok: false, reason: "not_configured" };
  }
  if (!(await reserve(opts.kind))) {
    await log(opts.kind, userId, false, "Daily email budget reached");
    return { ok: false, reason: "budget" };
  }
  try {
    const from = `"${(process.env.MAIL_FROM_NAME || "Comskills Circle").replace(/"/g, "")}" <${process.env.GMAIL_USER}>`;
    await transporter().sendMail({
      from,
      to: opts.to,
      subject: opts.message.subject,
      text: opts.message.text,
      html: opts.message.html,
      headers: opts.unsubscribeUrl
        ? { "List-Unsubscribe": `<${opts.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
        : undefined,
    });
    await log(opts.kind, userId, true, null);
    return { ok: true };
  } catch (err) {
    await release();
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[mail] send failed:", scrubAddresses(msg));
    await log(opts.kind, userId, false, msg);
    return { ok: false, reason: "error", error: scrubAddresses(msg) };
  }
}

/** Today's count and the limits, for Admin. */
export async function emailUsageToday(): Promise<{ sent: number; dailyLimit: number; normalCap: number }> {
  const s = await getSettings();
  const { usage } = await collections();
  const doc = await usage.findOne({ _id: localDayKey() });
  return { sent: doc?.emailsSent ?? 0, dailyLimit: s.email.dailyLimit, normalCap: emailCap("digest", s.email) };
}

export async function recentEmailLog(limit = 60) {
  const { emailLog } = await collections();
  const docs = await emailLog.find({}).sort({ at: -1 }).limit(limit).toArray();
  return docs.map((d) => ({ at: d.at.toISOString(), kind: d.kind, ok: d.ok, error: d.error, hasUser: Boolean(d.userId) }));
}
