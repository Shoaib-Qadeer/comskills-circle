import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import { collections, toObjectId } from "./db";
import type { AccessStatus, UserDoc } from "./types";

/** Admin rights come only from ADMIN_EMAILS (comma-separated), never from the database. */
export function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && adminEmails().includes(email!.toLowerCase().trim());
}

/** Admins are always approved. */
export function accessStatus(u: Pick<UserDoc, "status" | "email">): AccessStatus {
  if (isAdminEmail(u.email)) return "approved";
  return u.status ?? "pending";
}

export { ACTIVE_MEMBER } from "./access";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login", error: "/denied" },
  // Phase 1 adds the email + password provider.
  providers: [],
  callbacks: {
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
