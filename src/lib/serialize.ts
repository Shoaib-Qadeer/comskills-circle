import type { ObjectId } from "mongodb";
import type {
  ConnectRequestDoc,
  ConnectRequestDTO,
  ConnectState,
  MemberCardDTO,
  MemberProfileDTO,
  MeDTO,
  MiniUserDTO,
  NotificationDoc,
  NotificationDTO,
  OpportunityDoc,
  OpportunityDTO,
  UserDoc,
} from "./types";
import { DEFAULT_NOTIFY } from "./types";
import { computeWarnings, isExpired } from "./warnings";
import { isHttpUrl } from "./url";
import { isAdminEmail } from "./auth";
import { canSeeContacts } from "./visibility";
import type { AppSettings } from "./settings";

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);

export function safeLinks(l: UserDoc["links"] | undefined): UserDoc["links"] {
  const out: UserDoc["links"] = {};
  for (const k of ["linkedin", "github", "portfolio"] as const) if (isHttpUrl(l?.[k])) out[k] = l![k];
  return out;
}

/** Same-origin URL that serves the member's photo; the version makes it safe to cache forever. */
export function photoUrlFor(u: Pick<UserDoc, "_id" | "hasPhoto" | "photoVersion">): string | null {
  return u.hasPhoto ? `/api/photos/${String(u._id)}?v=${u.photoVersion || 0}` : null;
}

const labelOf = (settings: Pick<AppSettings, "batches"> | null, id: string | null) =>
  (id && settings?.batches.find((b) => b.id === id)?.label) || null;

export function meDTO(u: UserDoc, settings: Pick<AppSettings, "batches"> | null = null): MeDTO {
  const isAdmin = isAdminEmail(u.email);
  return {
    id: String(u._id),
    email: u.email,
    name: u.name,
    photoUrl: photoUrlFor(u),
    role: u.role ?? "participant",
    teamTitle: u.teamTitle ?? null,
    batch: u.batch ?? null,
    batchLabel: labelOf(settings, u.batch ?? null),
    isTeam: u.role === "team" || isAdmin,
    isAdmin,
    onboarded: u.onboarded,
    university: u.university ?? "",
    city: u.city ?? "",
    country: u.country ?? "",
    whatsapp: u.whatsapp ?? null,
    contactEmail: u.contactEmail ?? null,
    fieldOfStudy: u.fieldOfStudy ?? "",
    skills: u.skills ?? [],
    tools: u.tools ?? [],
    experience: u.experience ?? "",
    links: safeLinks(u.links),
    lookingFor: u.lookingFor ?? [],
    lookingForNote: u.lookingForNote ?? "",
    volunteering: u.volunteering ?? { open: false, for: null, areas: [], hoursPerMonth: null },
    fields: u.fields ?? [],
    freeTags: u.freeTags ?? [],
    notify: u.notify ?? DEFAULT_NOTIFY,
    hasPosted: Boolean(u.hasPosted),
  };
}

export function memberCardDTO(u: UserDoc, viewerId: ObjectId | string, settings: Pick<AppSettings, "batches"> | null): MemberCardDTO {
  return {
    id: String(u._id),
    name: u.name,
    photoUrl: photoUrlFor(u),
    role: u.role ?? "participant",
    teamTitle: u.role === "team" ? u.teamTitle ?? null : null,
    isAdmin: isAdminEmail(u.email),
    batch: u.batch ?? null,
    batchLabel: labelOf(settings, u.batch ?? null),
    university: u.university ?? "",
    city: u.city ?? "",
    fieldOfStudy: u.fieldOfStudy ?? "",
    skills: u.skills ?? [],
    lookingFor: u.lookingFor ?? [],
    volunteerOpen: Boolean(u.volunteering?.open),
    fields: u.fields ?? [],
    isMe: String(u._id) === String(viewerId),
  };
}

/**
 * Full profile. Contacts are included ONLY when canSeeContacts() allows it — this is the one place
 * contact details leave the server.
 */
export function memberProfileDTO(
  u: UserDoc,
  viewer: Pick<UserDoc, "_id" | "isAdmin">,
  ctx: { connect: ConnectState; settings: Pick<AppSettings, "batches"> | null },
): MemberProfileDTO {
  const ownerId = String(u._id);
  const connected = ctx.connect.state === "connected";
  const show = canSeeContacts({ id: String(viewer._id), isAdmin: Boolean(viewer.isAdmin) }, ownerId, connected);
  return {
    ...memberCardDTO(u, viewer._id, ctx.settings),
    country: u.country ?? "",
    tools: u.tools ?? [],
    experience: u.experience ?? "",
    links: safeLinks(u.links),
    lookingForNote: u.lookingForNote ?? "",
    volunteering: u.volunteering ?? { open: false, for: null, areas: [], hoursPerMonth: null },
    freeTags: u.freeTags ?? [],
    contacts: show ? { whatsapp: u.whatsapp ?? null, email: u.contactEmail || u.email } : null,
    connect: ctx.connect,
    joinedAt: (u.createdAt ?? new Date()).toISOString(),
  };
}

export function miniUser(u: Pick<UserDoc, "_id" | "name" | "hasPhoto" | "photoVersion"> | null | undefined): MiniUserDTO | null {
  return u ? { id: String(u._id), name: u.name, photoUrl: photoUrlFor(u) } : null;
}
export type MiniUser = MiniUserDTO;

export function connectRequestDTO(r: ConnectRequestDoc, viewerId: ObjectId | string, people: Map<string, MiniUserDTO>): ConnectRequestDTO {
  const incoming = String(r.to) === String(viewerId);
  return {
    id: String(r._id),
    direction: incoming ? "incoming" : "outgoing",
    other: people.get(String(incoming ? r.from : r.to)) ?? null,
    message: r.message,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
  };
}

export function notificationDTO(n: NotificationDoc): NotificationDTO {
  return { id: String(n._id), kind: n.kind, text: n.text, href: n.href, read: n.read, createdAt: n.createdAt.toISOString() };
}

export function opportunityDTO(o: OpportunityDoc, viewer: Pick<UserDoc, "_id" | "isAdmin">, posters: Map<string, MiniUser>): OpportunityDTO {
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

/** Loads names and photos for attribution lines ("Posted by X"). Pending/declined people are left out. */
export async function loadMiniUsers(ids: (ObjectId | null | undefined)[]): Promise<Map<string, MiniUser>> {
  const { collections } = await import("./db");
  const { users } = await collections();
  const uniq = Array.from(new Set(ids.filter(Boolean).map(String)));
  if (!uniq.length) return new Map();
  const { ObjectId } = await import("mongodb");
  const docs = await users
    .find({ _id: { $in: uniq.map((id) => new ObjectId(id)) } }, { projection: { name: 1, hasPhoto: 1, photoVersion: 1 } })
    .toArray();
  return new Map(docs.map((d) => [String(d._id), miniUser(d)!]));
}
