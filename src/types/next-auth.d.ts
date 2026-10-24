import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string; isAdmin: boolean; sv: number };
  }
  interface User {
    sv?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    sv?: number;
  }
}
