import type { ObjectId } from "mongodb";
import type {
  MeDTO,
  OpportunityDoc,
  OpportunityDTO,
  PersonDTO,
  UserDoc,
} from "./types";
import { computeWarnings, isExpired } from "./warnings";
import { isHttpUrl } from "./url";

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);

function safeLinks(l: UserDoc["links"]): UserDoc["links"] {
  const out: UserDoc["links"] = {};
  for (const k of ["linkedin", "cv", "portfolio", "github"] as const) if (isHttpUrl(l?.[k])) out[k] = l[k];
  return out;
}

export function meDTO(u: UserDoc): MeDTO {
  return {
    id: String(u._id),
    email: u.email,
    name: u.name,
    photoUrl: u.photoUrl,
    onboarded: u.onboarded,
    visibility: u.visibility,
    headline: u.headline,
    summary: u.summary,
    fields: u.fields,
    freeTags: u.freeTags,
    targetRoles: u.targetRoles,
    preferredLocations: u.preferredLocations,
    openToFrench: u.openToFrench,
    skillsOffered: u.skillsOffered,
    collaborateOn: u.collaborateOn,
    links: safeLinks(u.links),
    isAdmin: u.isAdmin,
    hasPosted: Boolean(u.hasPosted),
  };
}

/** Whether `viewer` may see `u` at all. Private profiles are invisible to everyone else. */
export function isVisibleTo(u: UserDoc, viewerId: ObjectId | string): boolean {
  return String(u._id) === String(viewerId) || u.visibility !== "private";
}

/** Public card for a classmate. Never includes email, openToFrench or private users. */
export function personDTO(u: UserDoc, viewerId: ObjectId | string): PersonDTO | null {
  if (!u.onboarded || !isVisibleTo(u, viewerId)) return null;
  const open = u.visibility === "open";
  return {
    id: String(u._id),
    name: u.name,
    photoUrl: u.photoUrl,
    headline: u.headline,
    summary: u.summary,
    fields: u.fields,
    preferredLocations: u.preferredLocations,
    links: safeLinks(u.links),
    open,
    ...(open ? { skillsOffered: u.skillsOffered, collaborateOn: u.collaborateOn } : {}),
    isMe: String(u._id) === String(viewerId),
  };
}

/** Name for attribution lines ("Posted by X"). Private posters still show their name on what they post. */
export type MiniUser = { id: string; name: string; photoUrl: string | null };
export function miniUser(u: Pick<UserDoc, "_id" | "name" | "photoUrl"> | null | undefined): MiniUser | null {
  return u ? { id: String(u._id), name: u.name, photoUrl: u.photoUrl } : null;
}

export function opportunityDTO(
  o: OpportunityDoc,
  viewer: Pick<UserDoc, "_id" | "isAdmin">,
  posters: Map<string, MiniUser>,
): OpportunityDTO {
  const mine = Boolean(o.postedBy && String(o.postedBy) === String(viewer._id));
  return {
    id: String(o._id),
    url: isHttpUrl(o.url) ? o.url : "",
    postedBy: o.postedBy ? posters.get(String(o.postedBy)) ?? null : null,
    postedByMe: mine,
    title: o.title,
    organization: o.organization,
    location: o.location,
    remote: o.remote,
    type: o.type,
    deadline: iso(o.deadline),
    startDate: iso(o.startDate),
    durationMonths: o.durationMonths,
    paid: o.paid,
    frenchRequired: o.frenchRequired,
    fields: o.fields,
    tags: o.tags,
    eligibility: o.eligibility,
    summary: o.summary,
    posterNote: o.posterNote,
    ...(mine || viewer.isAdmin ? { matchCount: o.matchCount } : {}),
    status: isExpired(o.deadline) ? "expired" : "open",
    warnings: computeWarnings(o),
    createdAt: o.createdAt.toISOString(),
  };
}

export async function loadMiniUsers(ids: (ObjectId | null | undefined)[]): Promise<Map<string, MiniUser>> {
  const { collections } = await import("./db");
  const { users } = await collections();
  const uniq = Array.from(new Set(ids.filter(Boolean).map(String)));
  if (!uniq.length) return new Map();
  const { ObjectId } = await import("mongodb");
  const docs = await users
    .find({ _id: { $in: uniq.map((id) => new ObjectId(id)) } }, { projection: { name: 1, photoUrl: 1 } })
    .toArray();
  return new Map(docs.map((d) => [String(d._id), { id: String(d._id), name: d.name, photoUrl: d.photoUrl }]));
}
