import { z } from "zod";
import type { ObjectId } from "mongodb";
import { collections, ensureIndexes } from "./db";
import { ApiError, adminEmails, isAdminEmail } from "./auth";
import { getSettings, batchLabel } from "./settings";
import { CODE_MESSAGES, checkCode, createOneTimeToken, issueCode, normalizeEmail } from "./codes";
import { hashPassword } from "./password";
import { passwordProblem, PASSWORD_MAX } from "./password-rules";
import { appUrl, sendEmail } from "./mail";
import { approvedEmail, codeEmail, signupAlertEmail } from "./mail-templates";
import type { AccessStatus, UserDoc } from "./types";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .email("Enter a valid email address");

const passwordSchema = z
  .string()
  .max(PASSWORD_MAX)
  .superRefine((v, ctx) => {
    const p = passwordProblem(v);
    if (p) ctx.addIssue({ code: "custom", message: p });
  });

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: emailSchema,
  password: passwordSchema,
  batch: z.string().trim().max(40).nullable().default(null),
  saysTeam: z.boolean().default(false),
  consent: z.literal(true, { error: "Please agree to the privacy notice to continue" }),
});

export const codeSchema = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code");

export const verifySchema = z.object({ email: emailSchema, code: codeSchema });
export const resendSchema = z.object({ email: emailSchema, purpose: z.enum(["verify", "reset"]).default("verify") });
export const forgotSchema = z.object({ email: emailSchema });
export const resetSchema = z.object({ email: emailSchema, code: codeSchema, password: passwordSchema });

export const FORGOT_REPLY = "If that email has an account, we sent a code. Check your inbox (and spam).";
export const EXISTING_ACCOUNT = "That email already has an account. Log in or reset your password.";

/** A fresh user document as stored at sign-up (pending and unverified). */
export function newUserDoc(p: { name: string; email: string; passwordHash: string; batch: string | null; saysTeam: boolean; now: Date }): Omit<UserDoc, "_id"> {
  return {
    email: p.email,
    passwordHash: p.passwordHash,
    emailVerifiedAt: null,
    sessionVersion: 0,
    role: "participant",
    teamTitle: null,
    batch: null,
    signupHint: { batch: p.batch, saysTeam: p.saysTeam },
    name: p.name,
    status: "pending",
    statusChangedAt: p.now,
    onboarded: false,
    hasPosted: false,
    isAdmin: false,
    lastSeenAt: null,
    createdAt: p.now,
    updatedAt: p.now,
    ...legacyProfileDefaults(),
  } as Omit<UserDoc, "_id">;
}

// Profile fields are filled in during onboarding.
function legacyProfileDefaults() {
  return {
    photoUrl: null,
    visibility: "class" as const,
    headline: "",
    summary: "",
    fields: [],
    freeTags: [],
    targetRoles: [],
    preferredLocations: [],
    openToFrench: false,
    skillsOffered: [],
    collaborateOn: "",
    links: {},
  };
}

async function sendCode(email: string, purpose: "verify" | "reset", code: string, userId: ObjectId | null) {
  const r = await sendEmail({ to: email, userId, kind: "code", message: codeEmail(code, purpose) });
  if (!r.ok) {
    throw new ApiError(
      503,
      r.reason === "budget"
        ? "We've hit today's email limit. Please try again tomorrow, or message the Comskills team."
        : "We couldn't send the email right now. Try again in a few minutes.",
    );
  }
}

export async function signup(input: z.infer<typeof signupSchema>, ip: string): Promise<{ email: string }> {
  await ensureIndexes();
  const settings = await getSettings();
  const { users } = await collections();
  const email = normalizeEmail(input.email);
  const batch = input.batch && settings.batches.some((b) => b.id === input.batch && !b.archived) ? input.batch : null;
  const existing = await users.findOne({ email }, { projection: { _id: 1, emailVerifiedAt: 1 } });
  if (existing?.emailVerifiedAt) throw new ApiError(409, EXISTING_ACCOUNT);

  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  let userId: ObjectId;
  if (existing) {
    // Not verified yet: whoever controls the inbox finishes sign-up, so the newest details win.
    await users.updateOne(
      { _id: existing._id },
      { $set: { name: input.name, passwordHash, signupHint: { batch, saysTeam: input.saysTeam }, updatedAt: now } },
    );
    userId = existing._id;
  } else {
    try {
      const res = await users.insertOne(newUserDoc({ name: input.name, email, passwordHash, batch, saysTeam: input.saysTeam, now }) as UserDoc);
      userId = res.insertedId;
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw new ApiError(409, EXISTING_ACCOUNT);
      throw e;
    }
  }
  const code = await issueCode(email, "verify", ip);
  await sendCode(email, "verify", code, userId);
  return { email };
}

/** Decides the status right after the email is verified. */
export function statusAfterVerify(email: string, settings: { access: { requireApproval: boolean; preApprovedEmails: string[] } }, current: AccessStatus): AccessStatus {
  if (current === "rejected") return "rejected";
  if (isAdminEmail(email) || !settings.access.requireApproval || settings.access.preApprovedEmails.includes(email)) return "approved";
  return current === "approved" ? "approved" : "pending";
}

export async function verifyEmail(emailRaw: string, code: string): Promise<{ token: string; status: AccessStatus; onboarded: boolean }> {
  await ensureIndexes();
  const email = normalizeEmail(emailRaw);
  const result = await checkCode(email, "verify", code);
  if (result !== "ok") throw new ApiError(400, CODE_MESSAGES[result], { codeError: result });
  const { users } = await collections();
  const u = await users.findOne({ email });
  if (!u) throw new ApiError(400, CODE_MESSAGES.expired);
  const settings = await getSettings();
  const wasVerified = Boolean(u.emailVerifiedAt);
  const status = statusAfterVerify(email, settings, u.status ?? "pending");
  const now = new Date();
  await users.updateOne(
    { _id: u._id },
    { $set: { emailVerifiedAt: u.emailVerifiedAt ?? now, status, ...(status !== u.status ? { statusChangedAt: now } : {}), updatedAt: now } },
  );
  if (!wasVerified && status === "pending" && settings.email.newSignupAlert) {
    const message = signupAlertEmail({
      name: u.name,
      batch: batchLabel(settings, u.signupHint?.batch) ?? null,
      saysTeam: Boolean(u.signupHint?.saysTeam),
      url: appUrl("/admin?tab=people"),
    });
    // Alerts are best-effort; the in-app badge always shows waiting people.
    await Promise.all(adminEmails().map((to) => sendEmail({ to, kind: "signupAlert", message }).catch(() => null)));
  }
  return { token: await createOneTimeToken(u._id), status, onboarded: Boolean(u.onboarded) };
}

export async function resendCode(emailRaw: string, purpose: "verify" | "reset", ip: string): Promise<void> {
  const email = normalizeEmail(emailRaw);
  const { users } = await collections();
  const u = await users.findOne({ email }, { projection: { _id: 1, emailVerifiedAt: 1 } });
  // Enumeration-safe: unknown emails (or already-verified ones asking for a verify code) get the same reply.
  if (!u || (purpose === "verify" && u.emailVerifiedAt)) return;
  const code = await issueCode(email, purpose, ip);
  await sendCode(email, purpose, code, u._id);
}

export async function forgotPassword(emailRaw: string, ip: string): Promise<void> {
  const email = normalizeEmail(emailRaw);
  const { users } = await collections();
  const u = await users.findOne({ email }, { projection: { _id: 1 } });
  if (!u) {
    // Count the attempt anyway so this endpoint can't be used to probe at full speed.
    const { limitWindow } = await import("./ratelimit");
    await limitWindow("code-ip", ip, 20, "hour", "Too many requests from this network. Try again in an hour.");
    return;
  }
  const code = await issueCode(email, "reset", ip);
  await sendCode(email, "reset", code, u._id);
}

/** Sets a new password, signs out every other device (sessionVersion + 1) and returns a sign-in token. */
export async function resetPassword(emailRaw: string, code: string, password: string): Promise<{ token: string }> {
  const email = normalizeEmail(emailRaw);
  const result = await checkCode(email, "reset", code);
  if (result !== "ok") throw new ApiError(400, CODE_MESSAGES[result], { codeError: result });
  const { users } = await collections();
  const passwordHash = await hashPassword(password);
  const now = new Date();
  const u = await users.findOneAndUpdate(
    { email },
    { $set: { passwordHash, updatedAt: now }, $inc: { sessionVersion: 1 } },
    { returnDocument: "after" },
  );
  if (!u) throw new ApiError(400, CODE_MESSAGES.expired);
  // Reading the code proved they own the inbox
  if (!u.emailVerifiedAt) {
    const settings = await getSettings();
    const status = statusAfterVerify(email, settings, u.status ?? "pending");
    await users.updateOne({ _id: u._id }, { $set: { emailVerifiedAt: now, status } });
  }
  return { token: await createOneTimeToken(u._id) };
}

/** Sends the "you're in" email when someone is approved. */
export async function sendApprovedEmail(u: Pick<UserDoc, "_id" | "email" | "name" | "onboarded">) {
  await sendEmail({ to: u.email, userId: u._id, kind: "approved", message: approvedEmail(u.name, appUrl(u.onboarded ? "/projects" : "/onboarding")) });
}
