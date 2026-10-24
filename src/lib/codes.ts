import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { ObjectId } from "mongodb";
import { collections } from "./db";
import { ApiError } from "./auth";
import { limitWindow } from "./ratelimit";
import type { CodePurpose } from "./types";

export const CODE_TTL_MS = 15 * 60_000;
export const MAX_CODE_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60_000;
export const TOKEN_TTL_MS = 2 * 60_000;

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not set");
  return s;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** A uniformly random 6-digit code, e.g. "042917". */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Codes are stored only as a keyed hash (HMAC-SHA256 with NEXTAUTH_SECRET), never in plain text. */
export function hashCode(email: string, purpose: CodePurpose, code: string, key: string = secret()): string {
  return createHmac("sha256", key).update(`${purpose}:${normalizeEmail(email)}:${code}`).digest("hex");
}

function sameHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export type CodeCheck = "ok" | "invalid" | "expired" | "locked";

/**
 * Pure decision for one attempt. `doc` is the stored code (or null). Returns the outcome and
 * whether the stored code must be deleted (used, expired, or too many wrong tries).
 */
export function judgeCode(
  doc: { codeHash: string; attempts: number; expiresAt: Date } | null,
  submittedHash: string,
  now: Date = new Date(),
): { result: CodeCheck; consume: boolean; attemptsAfter: number } {
  if (!doc) return { result: "expired", consume: false, attemptsAfter: 0 };
  if (doc.expiresAt.getTime() <= now.getTime()) return { result: "expired", consume: true, attemptsAfter: doc.attempts };
  // A locked code stays locked (even for the right digits) until a new code is sent or it expires
  if (doc.attempts >= MAX_CODE_ATTEMPTS) return { result: "locked", consume: false, attemptsAfter: doc.attempts };
  if (sameHex(doc.codeHash, submittedHash)) return { result: "ok", consume: true, attemptsAfter: doc.attempts };
  const attemptsAfter = doc.attempts + 1;
  return { result: attemptsAfter >= MAX_CODE_ATTEMPTS ? "locked" : "invalid", consume: false, attemptsAfter };
}

export const CODE_MESSAGES: Record<Exclude<CodeCheck, "ok">, string> = {
  invalid: "That code isn't right. Check the email and try again.",
  expired: "That code has expired. Send a new one.",
  locked: "Too many wrong tries. Send a new code and use the newest email.",
};

/**
 * Creates a new code for this email + purpose, replacing older ones. Enforces the resend cooldown
 * and the hourly limits (5 per email, 20 per IP). Returns the plain code for the email.
 */
export async function issueCode(email: string, purpose: CodePurpose, ip: string): Promise<string> {
  const e = normalizeEmail(email);
  const { emailCodes } = await collections();
  const last = await emailCodes.findOne({ email: e, purpose }, { sort: { createdAt: -1 } });
  if (last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - last.createdAt.getTime())) / 1000);
    throw new ApiError(429, `Please wait ${wait} seconds before asking for another code.`, { retryAfter: wait });
  }
  await limitWindow("code-email", e, 5, "hour", "Too many codes for this email. Try again in an hour.");
  await limitWindow("code-ip", ip, 20, "hour", "Too many codes from this network. Try again in an hour.");
  const code = generateCode();
  const now = new Date();
  await emailCodes.deleteMany({ email: e, purpose });
  await emailCodes.insertOne({
    email: e,
    purpose,
    codeHash: hashCode(e, purpose, code),
    attempts: 0,
    expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    createdAt: now,
  } as never);
  return code;
}

/** Checks a submitted code and records the attempt. Codes work once. */
export async function checkCode(email: string, purpose: CodePurpose, code: string): Promise<CodeCheck> {
  const e = normalizeEmail(email);
  const { emailCodes } = await collections();
  const doc = await emailCodes.findOne({ email: e, purpose }, { sort: { createdAt: -1 } });
  const clean = code.replace(/\D/g, "").slice(0, 6);
  const verdict = judgeCode(doc, hashCode(e, purpose, clean));
  if (doc) {
    if (verdict.consume) await emailCodes.deleteOne({ _id: doc._id });
    else if (verdict.attemptsAfter !== doc.attempts) await emailCodes.updateOne({ _id: doc._id }, { $set: { attempts: verdict.attemptsAfter } });
  }
  return verdict.result;
}

/* ---------------- one-time sign-in tokens (2 minutes, single use) ---------------- */

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Created right after a code is verified, so the browser can sign in without re-typing the password. */
export async function createOneTimeToken(userId: ObjectId): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const { oneTimeTokens } = await collections();
  await oneTimeTokens.insertOne({ _id: sha256(token), userId, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) });
  return token;
}

/** Consumes a token: returns the user id once, then the token is gone. */
export async function consumeOneTimeToken(token: string): Promise<ObjectId | null> {
  if (!token || token.length > 200) return null;
  const { oneTimeTokens } = await collections();
  const doc = await oneTimeTokens.findOneAndDelete({ _id: sha256(token) });
  if (!doc || doc.expiresAt.getTime() <= Date.now()) return null;
  return doc.userId;
}

/* ---------------- signed tokens for unsubscribe links ---------------- */

export function signValue(value: string, key: string = secret()): string {
  return createHmac("sha256", key).update(`unsub:${value}`).digest("base64url").slice(0, 32);
}

export function verifySignedValue(value: string, sig: string, key: string = secret()): boolean {
  const expected = signValue(value, key);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig || "");
  return a.length === b.length && timingSafeEqual(a, b);
}
