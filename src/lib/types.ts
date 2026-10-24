import type { ObjectId } from "mongodb";

export type Visibility = "private" | "class" | "open";
export type RemoteMode = "onsite" | "hybrid" | "remote";
export type OppType = "internship" | "fellowship" | "summer_school" | "competition" | "event" | "job" | "other";

export type Links = { linkedin?: string; cv?: string; portfolio?: string; github?: string };
export type AccessStatus = "pending" | "approved" | "rejected";

export type Role = "participant" | "team";

export interface UserDoc {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  /** Bumped on password change/reset; sessions carrying an older version are rejected. */
  sessionVersion: number;
  role: Role;
  teamTitle: string | null;
  batch: string | null;
  signupHint: { batch: string | null; saysTeam: boolean };
  name: string;
  photoUrl: string | null;
  onboarded: boolean;
  visibility: Visibility;
  headline: string;
  summary: string;
  fields: string[];
  freeTags: string[];
  targetRoles: string[];
  preferredLocations: string[];
  openToFrench: boolean;
  skillsOffered: string[];
  collaborateOn: string;
  links: Links;
  isAdmin: boolean;
  hasPosted: boolean;
  /** Missing on accounts created before approvals existed — treated as approved. */
  status?: AccessStatus;
  statusChangedAt?: Date | null;
  lastSeenAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
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
  deadline: Date | null;
  startDate: Date | null;
  durationMonths: number | null;
  paid: boolean | null;
  frenchRequired: boolean | null;
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
  | "french_required"
  | "duration_mismatch"
  | "duration_unknown"
  | "deadline_unknown"
  | "unpaid";

export type Warning = { kind: WarningKind; label: string };

export interface MatchDoc {
  _id: ObjectId;
  userId: ObjectId;
  opportunityId: ObjectId;
  score: number;
  reason: string;
  basic: boolean; // produced by the fallback matcher
  source: "auto" | "tagged";
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
  onboarded: boolean;
  visibility: Visibility;
  headline: string;
  summary: string;
  fields: string[];
  freeTags: string[];
  targetRoles: string[];
  preferredLocations: string[];
  openToFrench: boolean;
  skillsOffered: string[];
  collaborateOn: string;
  links: Links;
  isAdmin: boolean;
  hasPosted: boolean;
}

export interface PersonDTO {
  id: string;
  name: string;
  photoUrl: string | null;
  headline: string;
  summary?: string;
  fields: string[];
  preferredLocations: string[];
  links: Links;
  open: boolean;
  skillsOffered?: string[];
  collaborateOn?: string;
  isMe: boolean;
}

export interface OpportunityDTO {
  id: string;
  url: string;
  postedBy: { id: string; name: string; photoUrl: string | null } | null;
  postedByMe: boolean;
  title: string;
  organization: string | null;
  location: string | null;
  remote: RemoteMode | null;
  type: OppType;
  deadline: string | null;
  startDate: string | null;
  durationMonths: number | null;
  paid: boolean | null;
  frenchRequired: boolean | null;
  fields: string[];
  tags: string[];
  eligibility: string | null;
  summary: string;
  posterNote: string | null;
  matchCount?: number; // poster/admin only
  status: "open" | "expired";
  warnings: Warning[];
  createdAt: string;
}

export interface MatchDTO {
  id: string;
  score: number;
  reason: string;
  basic: boolean;
  source: "auto" | "tagged";
  taggedBy: { id: string; name: string } | null;
  taggedNote: string | null;
  seen: boolean;
  saved: boolean;
  coach: CoachAdvice | null;
  opportunity: OpportunityDTO;
}

export interface ExtractedDraft {
  url: string;
  title: string;
  organization: string | null;
  location: string | null;
  remote: RemoteMode | null;
  type: OppType;
  deadline: string | null;
  startDate: string | null;
  durationMonths: number | null;
  paid: boolean | null;
  frenchRequired: boolean | null;
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
