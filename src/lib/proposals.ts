import type { ObjectId } from "mongodb";
import { z } from "zod";
import { collections } from "./db";
import { isHttpUrl } from "./url";
import { photoUrlFor } from "./serialize";
import type {
  MemberStatus,
  MiniUserDTO,
  ProposalCardDTO,
  ProposalDetailDTO,
  ProposalDoc,
  ProposalMemberDoc,
  ProposalStatus,
  TeamMemberDTO,
  UserDoc,
} from "./types";

/* ------------------------------------------------------------------ input */

const chip = z.string().trim().min(1).max(40);
const uniqueChips = (max: number) =>
  z
    .array(chip)
    .max(max)
    .transform((a) => Array.from(new Map(a.map((x) => [x.toLowerCase(), x])).values()));

export const proposalInputSchema = z.object({
  title: z.string().trim().min(5, "Give your project a title (at least 5 characters)").max(90, "Keep the title under 90 characters"),
  problem: z.string().trim().min(20, "Describe the problem in a sentence or two").max(600),
  idea: z.string().trim().min(20, "Describe your idea in a sentence or two").max(900),
  peopleNeeded: z.object({
    count: z.number().int().min(1, "You need at least 1 person").max(20, "20 people at most"),
    skills: uniqueChips(10),
  }),
  commitment: z.object({
    hoursPerWeek: z.number().int().min(0).max(60).nullable(),
    duration: z.string().trim().max(40),
  }),
  fields: z.array(z.string()).max(4),
  tags: uniqueChips(6).transform((a) => a.map((t) => t.toLowerCase())),
  links: z
    .array(z.string().trim().max(500).refine((v) => isHttpUrl(v), "Links must start with https://"))
    .max(3, "Up to 3 links"),
});
export type ProposalInput = z.infer<typeof proposalInputSchema>;

export const proposalPatchSchema = proposalInputSchema.partial().extend({
  status: z.enum(["open", "team_forming", "in_progress", "completed"]).optional(),
  acceptingMembers: z.boolean().optional(),
});

/* ------------------------------------------------------------------ rules (pure) */

export const STATUS_ORDER: ProposalStatus[] = ["open", "team_forming", "in_progress", "completed"];

/** Can this person say "I'm interested"? Returns null if yes, otherwise the reason shown to them. */
export function interestBlocker(
  p: Pick<ProposalDoc, "proposedBy" | "status" | "acceptingMembers">,
  viewerId: string,
  myStatus: MemberStatus | null,
): string | null {
  if (p.proposedBy && String(p.proposedBy) === viewerId) return "You can't join your own project.";
  if (myStatus === "accepted") return "You're already on this team.";
  if (myStatus === "interested") return "You've already said you're interested.";
  if (myStatus === "declined") return "The proposer chose other people for this one.";
  if (myStatus === "removed") return "You were removed from this team.";
  if (p.status === "completed") return "This project is completed.";
  // An invite lets you in even when the proposer has stopped taking new people
  if (!p.acceptingMembers && myStatus !== "invited") return "This team isn't taking new members right now.";
  return null;
}

/** "2 of 4" style numbers. */
export function teamCounts(peopleNeeded: number, accepted: number) {
  return { accepted, needed: peopleNeeded, openSpots: Math.max(0, peopleNeeded - accepted), full: accepted >= peopleNeeded };
}

/** When the team is full we *offer* to move on (Team forming → In progress, stop accepting), never force it. */
export function shouldOfferStart(p: Pick<ProposalDoc, "status" | "acceptingMembers" | "peopleNeeded">, accepted: number): boolean {
  return accepted >= p.peopleNeeded.count && (p.status === "open" || p.status === "team_forming" || p.acceptingMembers);
}

/** Proposer actions on a member: which transitions are allowed. */
export function canProposerSet(from: MemberStatus, to: "accepted" | "declined" | "removed"): boolean {
  if (to === "accepted") return from === "interested" || from === "declined";
  if (to === "declined") return from === "interested" || from === "invited";
  return from === "accepted";
}

/** Applying a status change: completing a project closes it to new members. */
export function applyStatus(next: ProposalStatus, acceptingMembers: boolean): { status: ProposalStatus; acceptingMembers: boolean } {
  return { status: next, acceptingMembers: next === "completed" ? false : acceptingMembers };
}

/* ------------------------------------------------------------------ DTOs */

type UserLite = Pick<UserDoc, "_id" | "name" | "hasPhoto" | "photoVersion" | "fieldOfStudy" | "skills" | "status" | "onboarded">;
const mini = (u: UserLite): MiniUserDTO => ({ id: String(u._id), name: u.name, photoUrl: photoUrlFor(u) });

export function proposalCardDTO(
  p: ProposalDoc,
  viewerId: ObjectId | string,
  ctx: {
    people: Map<string, UserLite>;
    acceptedIds: string[];
    myStatus: MemberStatus | null;
    match: { score: number; reason: string; basic: boolean } | null;
  },
): ProposalCardDTO {
  const proposer = p.proposedBy ? ctx.people.get(String(p.proposedBy)) : null;
  const team = ctx.acceptedIds.map((id) => ctx.people.get(id)).filter((u): u is UserLite => Boolean(u));
  return {
    id: String(p._id),
    title: p.title,
    problem: p.problem,
    proposer: proposer ? mini(proposer) : null,
    proposedByMe: Boolean(p.proposedBy && String(p.proposedBy) === String(viewerId)),
    status: p.status,
    acceptingMembers: p.acceptingMembers,
    peopleNeeded: p.peopleNeeded,
    acceptedCount: team.length,
    commitment: p.commitment,
    fields: p.fields,
    tags: p.tags,
    team: team.slice(0, 6).map(mini),
    myStatus: ctx.myStatus,
    match: ctx.match,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function teamMemberDTO(m: ProposalMemberDoc, u: UserLite): TeamMemberDTO {
  return { ...mini(u), fieldOfStudy: u.fieldOfStudy ?? "", skills: (u.skills ?? []).slice(0, 6), note: m.note, status: m.status, at: (m.decidedAt ?? m.createdAt).toISOString() };
}

export function proposalDetailDTO(
  p: ProposalDoc,
  viewer: Pick<UserDoc, "_id" | "isAdmin">,
  ctx: { people: Map<string, UserLite>; members: ProposalMemberDoc[]; match: { score: number; reason: string; basic: boolean } | null },
): ProposalDetailDTO {
  const vid = String(viewer._id);
  // Only members who are still listed show up (a declined/pending account never appears)
  const listed = ctx.members.filter((m) => {
    const u = ctx.people.get(String(m.userId));
    return u && u.status === "approved" && u.onboarded;
  });
  const accepted = listed.filter((m) => m.status === "accepted");
  const mine = ctx.members.find((m) => String(m.userId) === vid) ?? null;
  const canManage = Boolean((p.proposedBy && String(p.proposedBy) === vid) || viewer.isAdmin);
  const card = proposalCardDTO(p, viewer._id, { people: ctx.people, acceptedIds: accepted.map((m) => String(m.userId)), myStatus: mine?.status ?? null, match: ctx.match });
  const asDto = (ms: ProposalMemberDoc[]) => ms.map((m) => teamMemberDTO(m, ctx.people.get(String(m.userId))!));
  return {
    ...card,
    idea: p.idea,
    links: p.links.filter((l) => isHttpUrl(l)),
    teamMembers: asDto(accepted),
    myNote: mine?.note ?? null,
    statusChangedAt: p.statusChangedAt.toISOString(),
    canManage,
    manage: canManage
      ? {
          interested: asDto(listed.filter((m) => m.status === "interested")),
          invited: asDto(listed.filter((m) => m.status === "invited")),
          past: asDto(listed.filter((m) => m.status === "declined" || m.status === "removed" || m.status === "left")),
          matchCount: p.matchCount,
        }
      : null,
  };
}

/** Loads what the board needs for a list of proposals in four queries. */
export async function loadProposalContext(props: ProposalDoc[], viewerId: ObjectId) {
  const c = await collections();
  const ids = props.map((p) => p._id);
  const [members, myMatches] = await Promise.all([
    c.proposalMembers.find({ proposalId: { $in: ids }, $or: [{ status: "accepted" }, { userId: viewerId }] }).toArray(),
    c.matches.find({ userId: viewerId, kind: "proposal", targetId: { $in: ids }, dismissed: false }).toArray(),
  ]);
  const userIds = Array.from(new Set([...props.map((p) => p.proposedBy).filter(Boolean).map(String), ...members.map((m) => String(m.userId))]));
  const { ObjectId } = await import("mongodb");
  const people = await c.users
    .find(
      { _id: { $in: userIds.map((x) => new ObjectId(x)) } },
      { projection: { name: 1, hasPhoto: 1, photoVersion: 1, fieldOfStudy: 1, skills: 1, status: 1, onboarded: 1 } },
    )
    .toArray();
  const peopleMap = new Map(people.map((u) => [String(u._id), u as UserLite]));
  const isListed = (id: string) => {
    const u = peopleMap.get(id);
    return Boolean(u && u.status === "approved" && u.onboarded);
  };
  const acceptedBy = new Map<string, string[]>();
  const myStatus = new Map<string, MemberStatus>();
  for (const m of members) {
    if (m.status === "accepted" && isListed(String(m.userId))) acceptedBy.set(String(m.proposalId), [...(acceptedBy.get(String(m.proposalId)) ?? []), String(m.userId)]);
    if (String(m.userId) === String(viewerId)) myStatus.set(String(m.proposalId), m.status);
  }
  const matchBy = new Map(myMatches.map((m) => [String(m.targetId), { score: m.score, reason: m.reason, basic: m.basic }]));
  return { people: peopleMap, acceptedBy, myStatus, matchBy };
}
