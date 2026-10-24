/** Mongo filter for members who appear in the community: verified, approved and onboarded. */
export const ACTIVE_MEMBER = { onboarded: true, status: "approved" as const, emailVerifiedAt: { $ne: null } };
