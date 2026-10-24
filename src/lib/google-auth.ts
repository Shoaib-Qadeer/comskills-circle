import { collections, ensureIndexes } from "./db";
import { getSettings, batchLabel } from "./settings";
import { newUserDoc, statusAfterVerify } from "./accounts";
import { adminEmails } from "./auth";
import { appUrl, sendEmail } from "./mail";
import { signupAlertEmail } from "./mail-templates";
import { later } from "./notify";
import { normalizeEmail } from "./codes";
import type { UserDoc } from "./types";

export type GoogleProfile = { email?: string | null; email_verified?: boolean | null; name?: string | null };

/** Pure: a clean display name from Google's profile, falling back to the email's first part. */
export function nameFromGoogle(p: GoogleProfile, email: string): string {
  const n = (p.name || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (n.length >= 2) return n;
  const local = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  return (local.charAt(0).toUpperCase() + local.slice(1)).slice(0, 80) || "Member";
}

/**
 * Called when someone finishes Google sign-in. Google has checked the email, so the account
 * counts as verified. New people are created (pending unless they are an admin, pre-approved,
 * or approval is switched off); an existing account with that email is reused, whichever way it
 * was made. Returns null when Google says the email isn't verified.
 */
export async function upsertGoogleUser(p: GoogleProfile): Promise<Pick<UserDoc, "_id" | "sessionVersion" | "status"> | null> {
  const email = normalizeEmail(String(p.email || ""));
  if (!email || p.email_verified === false) return null;
  // Indexes (including the unique email index) are created in the background on the first sign-in
  later(() => ensureIndexes());
  const [settings, { users }] = await Promise.all([getSettings(), collections()]);
  const now = new Date();
  const existing = await users.findOne({ email }, { projection: { _id: 1, status: 1, emailVerifiedAt: 1, sessionVersion: 1, name: 1, signupHint: 1 } });

  if (existing) {
    if (existing.emailVerifiedAt) return existing;
    // Made with email + password but never confirmed: Google confirms it now
    const status = statusAfterVerify(email, settings, existing.status ?? "pending");
    await users.updateOne({ _id: existing._id }, { $set: { emailVerifiedAt: now, status, statusChangedAt: now, updatedAt: now } });
    if (status === "pending") alertAdmins(existing.name, settings, existing.signupHint?.batch ?? null);
    return { ...existing, status };
  }

  const doc = newUserDoc({ name: nameFromGoogle(p, email), email, passwordHash: "", batch: null, saysTeam: false, now });
  const status = statusAfterVerify(email, settings, "pending");
  const full = { ...doc, emailVerifiedAt: now, status, statusChangedAt: now };
  // Upsert on email so two quick sign-ins can't make two accounts
  const r = await users.updateOne({ email }, { $setOnInsert: full }, { upsert: true });
  const saved = await users.findOne({ email }, { projection: { _id: 1, status: 1, sessionVersion: 1 } });
  if (r.upsertedCount && status === "pending") alertAdmins(full.name, settings, null);
  return saved;
}

function alertAdmins(name: string, settings: Awaited<ReturnType<typeof getSettings>>, batch: string | null) {
  if (!settings.email.newSignupAlert) return;
  const message = signupAlertEmail({ name, batch: batchLabel(settings, batch) ?? null, saysTeam: false, url: appUrl("/admin?tab=people") });
  // Best-effort, after the response, so sign-in isn't slowed down
  later(() => Promise.all(adminEmails().map((to) => sendEmail({ to, kind: "signupAlert", message }).catch(() => null))));
}
