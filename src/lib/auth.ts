import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { collections, ensureIndexes, toObjectId } from "./db";
import { getSettings } from "./settings";
import type { AccessStatus, UserDoc } from "./types";

// One or more allowed email domains, comma-separated (e.g. "learningplanetinstitute.org,cri-paris.org")
const DOMAINS = (process.env.ALLOWED_EMAIL_DOMAIN || "learningplanetinstitute.org")
  .split(",")
  .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
  .filter(Boolean);

/** The admin dashboard is only for these accounts (ADMIN_EMAILS, defaulting to Shoaib's LPI address). */
export function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || "shoaib.qadeer@learningplanetinstitute.org";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && adminEmails().includes(email!.toLowerCase().trim());
}

/** The real lock. The `hd` param below is only a hint on Google's account chooser and can be bypassed. */
export function isAllowedEmail(email: string | null | undefined, emailVerified: unknown, extraAllowed: string[] = []): boolean {
  if (!email || emailVerified !== true) return false;
  const e = email.toLowerCase().trim();
  const at = e.lastIndexOf("@");
  if (at <= 0) return false;
  return DOMAINS.includes(e.slice(at + 1)) || extraAllowed.includes(e) || isAdminEmail(e);
}

/** Missing status (accounts from before approvals existed) counts as approved. Admins are always approved. */
export function accessStatus(u: Pick<UserDoc, "status" | "email">): AccessStatus {
  if (isAdminEmail(u.email)) return "approved";
  return u.status ?? "approved";
}

export { ACTIVE_MEMBER } from "./access";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/", error: "/denied" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      // `hd` only narrows Google's account chooser; it supports a single domain
      authorization: { params: DOMAINS.length === 1 ? { hd: DOMAINS[0], prompt: "select_account" } : { prompt: "select_account" } },
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      const p = profile as { email?: string; email_verified?: boolean; name?: string; picture?: string } | undefined;
      try {
        const settings = await getSettings();
        if (!p || !isAllowedEmail(p.email, p.email_verified, settings.access.extraAllowedEmails)) {
          return "/denied?reason=domain";
        }
        await ensureIndexes();
        const { users } = await collections();
        const email = p.email!.toLowerCase();
        const now = new Date();
        const initialStatus: AccessStatus =
          isAdminEmail(email) || !settings.access.requireApproval || settings.access.preApprovedEmails.includes(email) ? "approved" : "pending";
        await users.updateOne(
          { email },
          {
            $set: { name: p.name || email.split("@")[0], photoUrl: p.picture || null, updatedAt: now, lastSeenAt: now },
            $setOnInsert: {
              email,
              status: initialStatus,
              statusChangedAt: now,
              onboarded: false,
              visibility: "class",
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
              isAdmin: false,
              hasPosted: false,
              createdAt: now,
            },
          },
          { upsert: true },
        );
        // A pending person who was pre-approved later gets in on their next sign-in
        if (settings.access.preApprovedEmails.includes(email)) {
          await users.updateOne({ email, status: "pending" }, { $set: { status: "approved", statusChangedAt: now } });
        }
        return true;
      } catch (err) {
        // Most often: MongoDB Atlas Network Access doesn't allow Vercel, or MONGODB_URI is wrong
        console.error("[auth] could not save the user to the database", err);
        return "/denied?reason=database";
      }
    },
    async jwt({ token, profile }) {
      if (profile && token.email) {
        const { users } = await collections();
        const u = await users.findOne({ email: token.email.toLowerCase() }, { projection: { _id: 1 } });
        if (u) token.userId = String(u._id);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId as string) || "";
        session.user.isAdmin = isAdminEmail(token.email);
      }
      return session;
    },
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: Record<string, unknown>) {
    super(message);
  }
}

/** Returns the signed-in user's document, or null. */
export async function getCurrentUser(): Promise<UserDoc | null> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) return null;
  const oid = toObjectId(id);
  if (!oid) return null;
  const { users } = await collections();
  const user = await users.findOne({ _id: oid });
  if (!user) return null;
  // Admin rights come from env, never from the database
  user.isAdmin = isAdminEmail(user.email);
  user.status = accessStatus(user);
  // Track activity for the admin dashboard, at most every 10 minutes
  if (!user.lastSeenAt || Date.now() - new Date(user.lastSeenAt).getTime() > 10 * 60_000) {
    users.updateOne({ _id: oid }, { $set: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return user;
}

export async function requireUser(opts: { onboarded?: boolean; approved?: boolean } = {}): Promise<UserDoc> {
  const { onboarded = true, approved = true } = opts;
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Please sign in.");
  if (approved && user.status !== "approved") throw new ApiError(403, "Your account is waiting for approval.");
  if (onboarded && !user.onboarded) throw new ApiError(403, "Finish onboarding first.");
  return user;
}

export async function requireAdmin(): Promise<UserDoc> {
  const user = await requireUser({ onboarded: false });
  if (!user.isAdmin) throw new ApiError(403, "Admins only");
  return user;
}
