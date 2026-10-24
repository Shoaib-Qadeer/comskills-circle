import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { collections, ensureIndexes, toObjectId } from "./db";
import type { AccessStatus, UserDoc } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: Record<string, unknown>) {
    super(message);
  }
}

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

/** Admins are always approved. Everyone else uses the stored status (new accounts start pending). */
export function accessStatus(u: Pick<UserDoc, "status" | "email">): AccessStatus {
  if (isAdminEmail(u.email)) return "approved";
  return u.status ?? "pending";
}

/** Team = someone an admin marked as team, or any admin. */
export function isTeam(u: Pick<UserDoc, "role" | "email">): boolean {
  return u.role === "team" || isAdminEmail(u.email);
}

export { ACTIVE_MEMBER } from "./access";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login", error: "/login" },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        oneTimeToken: { label: "Token", type: "text" },
      },
      async authorize(creds, req) {
        // Imported lazily so this module stays light for pages that only read the session.
        const { normalizeEmail, consumeOneTimeToken } = await import("./codes");
        const { verifyPassword, burnPasswordCheck } = await import("./password");
        const { hit, peek, clientIp } = await import("./ratelimit");
        let users;
        try {
          await ensureIndexes();
          users = (await collections()).users;
        } catch (err) {
          console.error("[auth] database unavailable", err);
          throw new Error("server");
        }
        const email = normalizeEmail(String(creds?.email || "")).slice(0, 200);

        // 1) One-time token, issued right after an email code is verified
        if (creds?.oneTimeToken) {
          const uid = await consumeOneTimeToken(String(creds.oneTimeToken));
          const u = uid ? await users.findOne({ _id: uid }) : null;
          if (!u || (email && u.email !== email) || !u.emailVerifiedAt) throw new Error("token");
          return { id: String(u._id), email: u.email, name: u.name, sv: u.sessionVersion ?? 0 };
        }

        // 2) Email + password, with lockouts (10 failures per email / 30 per IP in 15 minutes)
        const ip = clientIp(req?.headers as Record<string, string> | undefined);
        const [byEmail, byIp] = await Promise.all([peek("login-fail-email", email, "15min"), peek("login-fail-ip", ip, "15min")]);
        if (byEmail >= 10 || byIp >= 30) throw new Error("locked");
        const password = String(creds?.password || "").slice(0, 200);
        const u = email ? await users.findOne({ email }) : null;
        let ok = false;
        if (u) ok = await verifyPassword(password, u.passwordHash);
        else await burnPasswordCheck(password);
        if (!u || !ok) {
          await Promise.all([hit("login-fail-email", email || "-", "15min"), hit("login-fail-ip", ip, "15min")]);
          throw new Error("invalid");
        }
        if (!u.emailVerifiedAt) throw new Error("unverified");
        return { id: String(u._id), email: u.email, name: u.name, sv: u.sessionVersion ?? 0 };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.sv = user.sv ?? 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId as string) || "";
        session.user.sv = typeof token.sv === "number" ? token.sv : 0;
        session.user.isAdmin = isAdminEmail(token.email);
      }
      return session;
    },
  },
};

/** Returns the signed-in user's document, or null (also null when the session is from before a password change). */
export async function getCurrentUser(): Promise<UserDoc | null> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) return null;
  const oid = toObjectId(id);
  if (!oid) return null;
  const { users } = await collections();
  const user = await users.findOne({ _id: oid });
  if (!user || !user.emailVerifiedAt) return null;
  if ((user.sessionVersion ?? 0) !== (session.user.sv ?? 0)) return null;
  // Admin rights come from env, never from the database
  user.isAdmin = isAdminEmail(user.email);
  const status = accessStatus(user);
  if (user.isAdmin && user.status !== "approved") {
    users.updateOne({ _id: oid }, { $set: { status: "approved", statusChangedAt: new Date() } }).catch(() => {});
  }
  user.status = status;
  // Track activity for the admin dashboard, at most every 10 minutes
  if (!user.lastSeenAt || Date.now() - new Date(user.lastSeenAt).getTime() > 10 * 60_000) {
    users.updateOne({ _id: oid }, { $set: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return user;
}

export async function requireUser(opts: { onboarded?: boolean; approved?: boolean } = {}): Promise<UserDoc> {
  const { onboarded = true, approved = true } = opts;
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Please log in.");
  if (approved && user.status !== "approved") throw new ApiError(403, "Your account is waiting for approval.");
  if (onboarded && !user.onboarded) throw new ApiError(403, "Finish setting up your profile first.");
  return user;
}

/** Team members and admins. */
export async function requireTeam(): Promise<UserDoc> {
  const user = await requireUser();
  if (!isTeam(user)) throw new ApiError(403, "Only the Comskills team can do this.");
  return user;
}

export async function requireAdmin(): Promise<UserDoc> {
  const user = await requireUser({ onboarded: false });
  if (!user.isAdmin) throw new ApiError(403, "Admins only.");
  return user;
}
