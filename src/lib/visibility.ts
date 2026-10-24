// Privacy rules, as pure functions so they can be tested directly. Every DTO builder uses these;
// the UI never decides on its own what someone may see.

type Viewer = { id: string; isAdmin: boolean; isTeam?: boolean };

/**
 * WhatsApp and contact email are shown only to: the owner, admins, and people with an ACCEPTED
 * connect request with the owner (in either direction). Team members follow the same rule.
 */
export function canSeeContacts(viewer: Viewer, ownerId: string, connected: boolean): boolean {
  if (viewer.id === ownerId) return true;
  if (viewer.isAdmin) return true;
  return connected;
}

/** Whether someone appears anywhere in the community (directory, map, cards, matches). */
export function isListedMember(u: { status?: string; onboarded: boolean; emailVerifiedAt: Date | null }): boolean {
  return u.status === "approved" && u.onboarded && Boolean(u.emailVerifiedAt);
}

/**
 * Scholarship entries: applying / applied / accepted are visible to all members.
 * Rejected entries are visible to the owner, team and admins — and to other members only if the
 * owner chose "All members".
 */
export function scholarshipVisibleTo(
  entry: { userId: string; stage: string; rejectedVisibility: "team" | "members" },
  viewer: Viewer,
): boolean {
  if (entry.userId === viewer.id) return true;
  if (entry.stage !== "rejected") return true;
  if (viewer.isAdmin || viewer.isTeam) return true;
  return entry.rejectedVisibility === "members";
}

/** Mongo filter equivalent of scholarshipVisibleTo for a non-team viewer looking at someone else. */
export function visibleScholarshipFilterForMember() {
  return { $or: [{ stage: { $ne: "rejected" } }, { rejectedVisibility: "members" }] };
}

/** Sorted pair key: at most one pending connect request per pair of people. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}
