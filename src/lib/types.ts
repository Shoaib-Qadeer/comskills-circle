import type { ObjectId } from "mongodb";

export type RemoteMode = "onsite" | "hybrid" | "remote";
export type OppType = "scholarship" | "fellowship" | "internship" | "job" | "research" | "exchange" | "summer_school" | "competition" | "event" | "other";
export type DegreeLevel = "bachelor" | "master" | "phd" | "postdoc" | "any";
export type Funding = "full" | "partial" | "none";

export type Links = { linkedin?: string; github?: string; portfolio?: string };
export type AccessStatus = "pending" | "approved" | "rejected";
export type Role = "participant" | "team";
export type LookingFor = "scholarship" | "research" | "job" | "internship" | "collaborators";
export type VolunteerFor = "comskills" | "other" | "both";
export type DigestFrequency = "weekly" | "daily" | "off";

export type InstantPrefs = { interest: boolean; teamUpdates: boolean; connect: boolean; pinned: boolean; invites: boolean };
export type NotifyPrefs = { digest: DigestFrequency; instant: InstantPrefs };
export type Volunteering = { open: boolean; for: VolunteerFor | null; areas: string[]; hoursPerMonth: number | null };

export const DEFAULT_NOTIFY: NotifyPrefs = {
  digest: "weekly",
  instant: { interest: true, teamUpdates: true, connect: true, pinned: true, invites: true },
};

export interface UserDoc {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  /** Bumped on password change/reset; sessions carrying an older version are rejected. */
  sessionVersion: number;
  name: string;
  hasPhoto: boolean;
  /** Changes on every upload so photo URLs can be cached forever. */
  photoVersion: number;
  role: Role;
  /** e.g. "Mentor – scholarships" (team only). */
  teamTitle: string | null;
  /** id from settings.batches; participants only. */
  batch: string | null;
  /** What they said at sign-up; the admin sets the real role/batch. */
  signupHint: { batch: string | null; saysTeam: boolean };
  status?: AccessStatus;
  statusChangedAt?: Date | null;
  onboarded: boolean;
  // Basics
  university: string;
  city: string;
  country: string;
  /** E.164, e.g. +923001234567 */
  whatsapp: string | null;
  /** Defaults to the account email. */
  contactEmail: string | null;
  // Technical background
  fieldOfStudy: string;
  skills: string[];
  tools: string[];
  experience: string;
  links: Links;
  // Looking for
  lookingFor: LookingFor[];
  lookingForNote: string;
  // Volunteering
  volunteering: Volunteering;
  // Matching and the map
  fields: string[];
  freeTags: string[];
  // Notifications
  notify: NotifyPrefs;
  seen: { announcementsAt: Date | null; projectsAt: Date | null };
  lastDigestAt: Date | null;
  /** Runtime only (from ADMIN_EMAILS), never trusted from the database. */
  isAdmin: boolean;
  hasPosted: boolean;
  lastSeenAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Profile photos live outside `users` so member lists stay light. */
export interface PhotoDoc {
  _id: ObjectId; // = userId
  mime: "image/webp" | "image/jpeg";
  data: import("mongodb").Binary;
  updatedAt: Date;
}

export type ConnectStatus = "pending" | "accepted" | "declined";
export interface ConnectRequestDoc {
  _id: ObjectId;
  from: ObjectId;
  to: ObjectId;
  /** Sorted pair of ids, so there is at most one pending request per pair. */
  pairKey: string;
  message: string;
  status: ConnectStatus;
  createdAt: Date;
  decidedAt: Date | null;
}

export interface NotificationDoc {
  _id: ObjectId;
  userId: ObjectId;
  kind: string;
  text: string;
  href: string;
  read: boolean;
  createdAt: Date;
}

export type ProposalStatus = "open" | "team_forming" | "in_progress" | "completed";
export interface ProposalDoc {
  _id: ObjectId;
  proposedBy: ObjectId | null;
  title: string;
  problem: string;
  idea: string;
  peopleNeeded: { count: number; skills: string[] };
  commitment: { hoursPerWeek: number | null; duration: string };
  fields: string[];
  tags: string[];
  links: string[];
  status: ProposalStatus;
  acceptingMembers: boolean;
  statusChangedAt: Date;
  matchCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type MemberStatus = "invited" | "interested" | "accepted" | "declined" | "removed" | "left";
export interface ProposalMemberDoc {
  _id: ObjectId;
  proposalId: ObjectId;
  userId: ObjectId;
  status: MemberStatus;
  note: string;
  invitedBy: ObjectId | null;
  createdAt: Date;
  decidedAt: Date | null;
}

export type ScholarshipStage = "applying" | "applied" | "rejected" | "accepted";
export interface ScholarshipDoc {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  country: string;
  link: string | null;
  opportunityId: ObjectId | null;
  stage: ScholarshipStage;
  deadline: Date | null;
  submittedAt: Date | null;
  expectedResultAt: Date | null;
  rejectedAt: Date | null;
  lesson: string | null;
  programme: string | null;
  university: string | null;
  startDate: Date | null;
  rejectedVisibility: "team" | "members";
  announceConsent: boolean;
  announcedAt: Date | null;
  /** Deadline reminders already sent (days before: 7, 1). */
  remindersSent: number[];
  history: { stage: ScholarshipStage; at: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

export type AnnouncementCategory = "programme" | "event" | "deadline" | "opportunity" | "win";
export const REACTIONS = ["👍", "🎉", "❤️", "🙌", "💡"] as const;
export type Reaction = (typeof REACTIONS)[number];
export interface AnnouncementDoc {
  _id: ObjectId;
  authorId: ObjectId | null;
  title: string;
  body: string;
  category: AnnouncementCategory;
  link: string | null;
  pinned: boolean;
  pinnedUntil: Date | null;
  reactionCounts: Record<Reaction, number>;
  emailedAt: Date | null;
  emailedCount: number;
  scholarshipId: ObjectId | null;
  createdAt: Date;
  editedAt: Date | null;
}
export interface ReactionDoc {
  _id: ObjectId;
  announcementId: ObjectId;
  userId: ObjectId;
  emoji: Reaction;
  createdAt: Date;
}

export interface ReportDoc {
  _id: ObjectId;
  kind: "proposal";
  targetId: ObjectId;
  reporterId: ObjectId | null;
  reason: string;
  resolved: boolean;
  createdAt: Date;
}

export interface OpportunityDoc {
  _id: ObjectId;
  url: string; // as pasted (trimmed); used for "Open link"
  urlKey: string; // normalized, used for duplicate detection
  postedBy: ObjectId | null;
  title: string;
  organization: string | null;
  location: string | null;
  remote: RemoteMode | null;
  type: OppType;
  country: string | null;
  degreeLevel: DegreeLevel[];
  funding: Funding | null;
  deadline: Date | null;
  startDate: Date | null;
  durationMonths: number | null;
  paid: boolean | null;
  fields: string[];
  tags: string[];
  eligibility: string | null;
  summary: string;
  taggedFor: ObjectId[];
  posterNote: string | null;
  matchCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type WarningKind =
  | "deadline_soon"
  | "deadline_urgent"
  | "deadline_unknown"
  | "funding_unknown"
  | "unpaid";

export type Warning = { kind: WarningKind; label: string };

export type MatchKind = "opportunity" | "proposal";
export type MatchSource = "auto" | "tagged" | "invited";

/** One person matched to one opportunity or one project proposal (unique on userId + kind + targetId). */
export interface MatchDoc {
  _id: ObjectId;
  userId: ObjectId;
  kind: MatchKind;
  targetId: ObjectId;
  score: number;
  reason: string;
  basic: boolean; // produced by the rule-based fallback
  source: MatchSource;
  taggedBy: ObjectId | null;
  taggedNote: string | null;
  seen: boolean;
  saved: boolean;
  dismissed: boolean;
  coach?: CoachAdvice | null;
  createdAt: Date;
}

export interface CoachAdvice {
  whyYou: string;
  highlight: string[];
  gaps: string[];
  firstStep: string;
  createdAt: string;
}

export interface UsageDoc {
  _id: string; // YYYY-MM-DD in the app time zone
  llmCalls: number;
  emailsSent?: number;
  inputTokens?: number;
  outputTokens?: number;
  errors?: number;
}

export interface LlmLogDoc {
  _id?: import("mongodb").ObjectId;
  at: Date;
  label: string;
  model: string;
  ok: boolean;
  inputTokens: number;
  outputTokens: number;
  ms: number;
  error: string | null;
}

export type CodePurpose = "verify" | "reset";

export interface EmailCodeDoc {
  _id: ObjectId;
  email: string;
  purpose: CodePurpose;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  createdAt: Date;
}

export interface OneTimeTokenDoc {
  _id: string; // sha256 of the token
  userId: ObjectId;
  expiresAt: Date;
}

export interface EmailLogDoc {
  _id?: ObjectId;
  at: Date;
  kind: string;
  /** Recipient's user id when there is one; never the address. */
  userId: ObjectId | null;
  ok: boolean;
  error: string | null;
}

export interface RateDoc {
  _id: string; // `${action}:${userId}:${YYYY-MM-DD}`
  count: number;
  expiresAt: Date;
}

/* ---------- DTOs sent to the browser (string ids, visibility applied) ---------- */

export interface MeDTO {
  id: string;
  email: string;
  name: string;
  photoUrl: string | null;
  role: Role;
  teamTitle: string | null;
  batch: string | null;
  batchLabel: string | null;
  isTeam: boolean;
  isAdmin: boolean;
  onboarded: boolean;
  university: string;
  city: string;
  country: string;
  whatsapp: string | null;
  contactEmail: string | null;
  fieldOfStudy: string;
  skills: string[];
  tools: string[];
  experience: string;
  links: Links;
  lookingFor: LookingFor[];
  lookingForNote: string;
  volunteering: Volunteering;
  fields: string[];
  freeTags: string[];
  notify: NotifyPrefs;
  hasPosted: boolean;
}

/** Light card for the directory and pickers. Never includes contacts. */
export interface MemberCardDTO {
  id: string;
  name: string;
  photoUrl: string | null;
  role: Role;
  teamTitle: string | null;
  isAdmin: boolean;
  batch: string | null;
  batchLabel: string | null;
  university: string;
  city: string;
  fieldOfStudy: string;
  skills: string[];
  lookingFor: LookingFor[];
  volunteerOpen: boolean;
  fields: string[];
  isMe: boolean;
}

export type ConnectState =
  | { state: "self" }
  | { state: "none" }
  | { state: "outgoing"; requestId: string }
  | { state: "incoming"; requestId: string; message: string }
  | { state: "connected" }
  | { state: "declined" };

export interface MemberProfileDTO extends MemberCardDTO {
  country: string;
  tools: string[];
  experience: string;
  links: Links;
  lookingForNote: string;
  volunteering: Volunteering;
  freeTags: string[];
  /** Only for the owner, admins, and people with an accepted connect request. */
  contacts: { whatsapp: string | null; email: string | null } | null;
  connect: ConnectState;
  joinedAt: string;
}

export interface ConnectRequestDTO {
  id: string;
  direction: "incoming" | "outgoing";
  other: MiniUserDTO | null;
  message: string;
  status: ConnectStatus;
  createdAt: string;
  decidedAt: string | null;
}

export type MiniUserDTO = { id: string; name: string; photoUrl: string | null };

export interface NotificationDTO {
  id: string;
  kind: string;
  text: string;
  href: string;
  read: boolean;
  createdAt: string;
}

export interface OpportunityDTO {
  id: string;
  url: string;
  postedBy: MiniUserDTO | null;
  postedByMe: boolean;
  title: string;
  organization: string | null;
  location: string | null;
  remote: RemoteMode | null;
  type: OppType;
  country: string | null;
  degreeLevel: DegreeLevel[];
  funding: Funding | null;
  deadline: string | null;
  startDate: string | null;
  durationMonths: number | null;
  paid: boolean | null;
  fields: string[];
  tags: string[];
  eligibility: string | null;
  summary: string;
  posterNote: string | null;
  matchCount?: number; // poster/admin only
  status: "open" | "expired";
  warnings: Warning[];
  /** The viewer's tracker entry for this opportunity, if any. */
  trackedId?: string | null;
  createdAt: string;
}

interface MatchBaseDTO {
  id: string;
  score: number;
  reason: string;
  basic: boolean;
  source: MatchSource;
  taggedBy: { id: string; name: string } | null;
  taggedNote: string | null;
  seen: boolean;
  saved: boolean;
  createdAt: string;
}
export interface OpportunityMatchDTO extends MatchBaseDTO {
  kind: "opportunity";
  coach: CoachAdvice | null;
  opportunity: OpportunityDTO;
}
export interface ProposalMatchDTO extends MatchBaseDTO {
  kind: "proposal";
  proposal: ProposalCardDTO;
}
export type AnyMatchDTO = OpportunityMatchDTO | ProposalMatchDTO;
/** Kept for opportunity-only views. */
export type MatchDTO = OpportunityMatchDTO;

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  open: "Open",
  team_forming: "Team forming",
  in_progress: "In progress",
  completed: "Completed",
};

export interface ProposalCardDTO {
  id: string;
  title: string;
  problem: string;
  proposer: MiniUserDTO | null;
  proposedByMe: boolean;
  status: ProposalStatus;
  acceptingMembers: boolean;
  peopleNeeded: { count: number; skills: string[] };
  acceptedCount: number;
  commitment: { hoursPerWeek: number | null; duration: string };
  fields: string[];
  tags: string[];
  /** A few accepted members' faces for the card. */
  team: MiniUserDTO[];
  myStatus: MemberStatus | null;
  /** The viewer's match, if the matcher thinks it fits them. */
  match: { score: number; reason: string; basic: boolean } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMemberDTO extends MiniUserDTO {
  fieldOfStudy: string;
  skills: string[];
  note: string;
  status: MemberStatus;
  at: string;
}

export interface ProposalDetailDTO extends ProposalCardDTO {
  idea: string;
  links: string[];
  teamMembers: TeamMemberDTO[];
  myNote: string | null;
  statusChangedAt: string;
  /** Only for the proposer and admins: who's interested, invited, declined or gone. */
  manage: { interested: TeamMemberDTO[]; invited: TeamMemberDTO[]; past: TeamMemberDTO[]; matchCount: number } | null;
  canManage: boolean;
}

export interface SuggestedPersonDTO {
  member: MemberCardDTO;
  score: number;
  reason: string;
  basic: boolean;
  invited: boolean;
}

export interface ExtractedDraft {
  url: string;
  title: string;
  organization: string | null;
  location: string | null;
  remote: RemoteMode | null;
  type: OppType;
  country: string | null;
  degreeLevel: DegreeLevel[];
  funding: Funding | null;
  deadline: string | null;
  startDate: string | null;
  durationMonths: number | null;
  paid: boolean | null;
  fields: string[];
  tags: string[];
  eligibility: string | null;
  summary: string;
}

export interface ConstellationDTO {
  people: {
    id: string;
    name: string;
    photoUrl: string | null;
    headline: string;
    fields: string[];
    preferredLocations: string[];
    links: Links;
    open: boolean;
    isMe: boolean;
  }[];
  hubs: { slug: string; label: string; color: string; emoji: string; count: number }[];
  locations: { name: string; count: number }[];
  privateCount: number;
  meIncluded: boolean;
}
