import type { AccessStatus } from "./types";

/** Mongo filter for classmates who are active members (onboarded and not pending/rejected). */
export const ACTIVE_MEMBER = { onboarded: true, status: { $nin: ["pending", "rejected"] as AccessStatus[] } };
