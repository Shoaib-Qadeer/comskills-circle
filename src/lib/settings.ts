import { z } from "zod";
import { collections } from "./db";

/**
 * App-wide settings stored in MongoDB (collection "settings", document "app"), editable from Admin.
 * Secrets (API keys, DB URI, Gmail password) stay in environment variables.
 */

export const AI_FEATURES = ["extraction", "matchOpportunity", "matchProposal", "profileSuggestions", "coach"] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

export const PROMPT_KEYS = ["extraction", "matchOpportunity", "matchProfile", "matchProposal", "profile", "coach"] as const;
export type PromptKey = (typeof PROMPT_KEYS)[number];

/** Instant-email kinds an admin can switch on or off for everyone. Members also choose per kind. */
export const INSTANT_KINDS = ["interest", "teamUpdates", "connect", "pinned", "invites"] as const;
export type InstantKind = (typeof INSTANT_KINDS)[number];

const emailList = z
  .array(z.string().trim().toLowerCase().email())
  .max(1000)
  .transform((a) => Array.from(new Set(a)));

const batchSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "batch ids use lowercase letters, numbers and dashes"),
  label: z.string().trim().min(1).max(60),
  archived: z.boolean(),
});
export type Batch = z.infer<typeof batchSchema>;

export const settingsSchema = z.object({
  access: z.object({
    /** New sign-ups wait for an admin unless their email is pre-approved. */
    requireApproval: z.boolean(),
    /** These emails are approved automatically once they verify their email. */
    preApprovedEmails: emailList,
  }),
  batches: z
    .array(batchSchema)
    .max(60)
    .refine((a) => new Set(a.map((b) => b.id)).size === a.length, "batch ids must be unique"),
  email: z.object({
    /** Consumer Gmail allows about 500 recipients a day. */
    dailyLimit: z.number().int().min(0).max(2000),
    /** Kept back for sign-up and password-reset codes. */
    reserveForCodes: z.number().int().min(0).max(2000),
    digestEnabled: z.boolean(),
    /** 0 = Sunday … 6 = Saturday, in the app time zone. */
    digestWeekday: z.number().int().min(0).max(6),
    instant: z.object({
      interest: z.boolean(),
      teamUpdates: z.boolean(),
      connect: z.boolean(),
      pinned: z.boolean(),
      invites: z.boolean(),
    }),
    newSignupAlert: z.boolean(),
    monthlyNudge: z.boolean(),
  }),
  ai: z.object({
    enabled: z.boolean(),
    /** Overrides LLM_MODEL when set. */
    model: z.string().trim().max(120),
    dailyCallLimit: z.number().int().min(0).max(100_000),
    dailyTokenLimit: z.number().int().min(0).max(100_000_000),
    matchThreshold: z.number().int().min(1).max(100),
    extractionChars: z.number().int().min(2_000).max(120_000),
    /** Items (opportunities or proposals) per call when matching one profile. */
    profileBatchSize: z.number().int().min(1).max(50),
    /** Member profiles per call when matching one proposal or opportunity. */
    matchChunkSize: z.number().int().min(5).max(80),
    temperature: z.number().min(0).max(1),
    features: z.object({
      extraction: z.boolean(),
      matchOpportunity: z.boolean(),
      matchProposal: z.boolean(),
      profileSuggestions: z.boolean(),
      coach: z.boolean(),
    }),
    /** Optional system-prompt overrides; empty string = use the built-in prompt. */
    prompts: z.object({
      extraction: z.string().max(12_000),
      matchOpportunity: z.string().max(12_000),
      matchProfile: z.string().max(12_000),
      matchProposal: z.string().max(12_000),
      profile: z.string().max(12_000),
      coach: z.string().max(12_000),
    }),
  }),
  limits: z.object({
    extractPerDay: z.number().int().min(0).max(1000),
    postPerDay: z.number().int().min(0).max(1000),
    proposalsPerDay: z.number().int().min(0).max(1000),
    interestPerDay: z.number().int().min(0).max(1000),
    connectPerDay: z.number().int().min(0).max(1000),
    announcePerDay: z.number().int().min(0).max(1000),
    coachPerDay: z.number().int().min(0).max(1000),
    trackerPerDay: z.number().int().min(0).max(1000),
    reportsPerDay: z.number().int().min(0).max(1000),
  }),
});

export type AppSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  access: { requireApproval: true, preApprovedEmails: [] },
  batches: [],
  email: {
    dailyLimit: 400,
    reserveForCodes: 80,
    digestEnabled: true,
    digestWeekday: 1,
    instant: { interest: true, teamUpdates: true, connect: true, pinned: true, invites: true },
    newSignupAlert: true,
    monthlyNudge: false,
  },
  ai: {
    enabled: true,
    model: "",
    dailyCallLimit: 450,
    dailyTokenLimit: 1_000_000,
    matchThreshold: 60,
    extractionChars: 30_000,
    profileBatchSize: 20,
    matchChunkSize: 40,
    temperature: 0.1,
    features: { extraction: true, matchOpportunity: true, matchProposal: true, profileSuggestions: true, coach: true },
    prompts: { extraction: "", matchOpportunity: "", matchProfile: "", matchProposal: "", profile: "", coach: "" },
  },
  limits: {
    extractPerDay: 25,
    postPerDay: 15,
    proposalsPerDay: 5,
    interestPerDay: 30,
    connectPerDay: 15,
    announcePerDay: 20,
    coachPerDay: 30,
    trackerPerDay: 40,
    reportsPerDay: 10,
  },
};

type SettingsDoc = { _id: string; value: unknown; updatedAt: Date; updatedBy: string | null };

let cache: { at: number; value: AppSettings } | null = null;
const TTL_MS = 10_000;

/** Deep-merges stored values over defaults, so new settings keys get sensible values automatically. */
export function withDefaults(stored: unknown): AppSettings {
  const s = (stored && typeof stored === "object" ? stored : {}) as Partial<AppSettings>;
  const merged = {
    access: { ...DEFAULT_SETTINGS.access, ...(s.access || {}) },
    batches: Array.isArray(s.batches) ? s.batches : DEFAULT_SETTINGS.batches,
    email: {
      ...DEFAULT_SETTINGS.email,
      ...(s.email || {}),
      instant: { ...DEFAULT_SETTINGS.email.instant, ...(s.email?.instant || {}) },
    },
    ai: {
      ...DEFAULT_SETTINGS.ai,
      ...(s.ai || {}),
      features: { ...DEFAULT_SETTINGS.ai.features, ...(s.ai?.features || {}) },
      prompts: { ...DEFAULT_SETTINGS.ai.prompts, ...(s.ai?.prompts || {}) },
    },
    limits: { ...DEFAULT_SETTINGS.limits, ...(s.limits || {}) },
  };
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function getSettings(fresh = false): Promise<AppSettings> {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    const db = (await collections()).users.db;
    const doc = await db.collection<SettingsDoc>("settings").findOne({ _id: "app" });
    const value = withDefaults(doc?.value);
    cache = { at: Date.now(), value };
    return value;
  } catch (err) {
    console.error("[settings] falling back to defaults", err);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(value: AppSettings, updatedBy: string): Promise<AppSettings> {
  const clean = settingsSchema.parse(value);
  const db = (await collections()).users.db;
  await db
    .collection<SettingsDoc>("settings")
    .updateOne({ _id: "app" }, { $set: { value: clean, updatedAt: new Date(), updatedBy } }, { upsert: true });
  cache = { at: Date.now(), value: clean };
  return clean;
}

/** Batches people can pick (archived ones are hidden from sign-up but kept on profiles). */
export function activeBatches(s: AppSettings): Batch[] {
  return s.batches.filter((b) => !b.archived);
}

export function batchLabel(s: Pick<AppSettings, "batches">, id: string | null | undefined): string | null {
  if (!id) return null;
  return s.batches.find((b) => b.id === id)?.label ?? null;
}
