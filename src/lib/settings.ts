import { z } from "zod";
import { collections } from "./db";

/**
 * App-wide settings stored in MongoDB (collection "settings", one document "app"),
 * editable from the admin dashboard. Secrets (API keys, DB URI) stay in environment variables.
 */

export const AI_FEATURES = ["extraction", "matching", "profileSuggestions", "coach"] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

export const PROMPT_KEYS = ["extraction", "matchOpportunity", "matchProfile", "profile", "coach"] as const;
export type PromptKey = (typeof PROMPT_KEYS)[number];

const emailList = z
  .array(z.string().trim().toLowerCase().email())
  .max(500)
  .transform((a) => Array.from(new Set(a)));

export const settingsSchema = z.object({
  access: z.object({
    /** New sign-ups wait for an admin unless their email is pre-approved. */
    requireApproval: z.boolean(),
    /** These emails are approved automatically on first sign-in. */
    preApprovedEmails: emailList,
    /** Emails allowed to sign in even though they're outside the allowed domains. */
    extraAllowedEmails: emailList,
  }),
  ai: z.object({
    enabled: z.boolean(),
    /** Overrides LLM_MODEL when set. */
    model: z.string().trim().max(120),
    dailyCallLimit: z.number().int().min(0).max(100_000),
    dailyTokenLimit: z.number().int().min(0).max(100_000_000),
    matchThreshold: z.number().int().min(1).max(100),
    extractionChars: z.number().int().min(2_000).max(120_000),
    profileBatchSize: z.number().int().min(1).max(50),
    temperature: z.number().min(0).max(1),
    features: z.object({
      extraction: z.boolean(),
      matching: z.boolean(),
      profileSuggestions: z.boolean(),
      coach: z.boolean(),
    }),
    /** Optional system-prompt overrides; empty string = use the built-in prompt. */
    prompts: z.object({
      extraction: z.string().max(12_000),
      matchOpportunity: z.string().max(12_000),
      matchProfile: z.string().max(12_000),
      profile: z.string().max(12_000),
      coach: z.string().max(12_000),
    }),
  }),
  limits: z.object({
    extractPerDay: z.number().int().min(0).max(1000),
    postPerDay: z.number().int().min(0).max(1000),
    introPerDay: z.number().int().min(0).max(1000),
    coachPerDay: z.number().int().min(0).max(1000),
  }),
});

export type AppSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  access: { requireApproval: true, preApprovedEmails: [], extraAllowedEmails: [] },
  ai: {
    enabled: true,
    model: "",
    dailyCallLimit: 1000,
    dailyTokenLimit: 1_000_000,
    matchThreshold: 60,
    extractionChars: 30_000,
    profileBatchSize: 20,
    temperature: 0.1,
    features: { extraction: true, matching: true, profileSuggestions: true, coach: true },
    prompts: { extraction: "", matchOpportunity: "", matchProfile: "", profile: "", coach: "" },
  },
  limits: { extractPerDay: 25, postPerDay: 25, introPerDay: 10, coachPerDay: 30 },
};

type SettingsDoc = { _id: string; value: unknown; updatedAt: Date; updatedBy: string | null };

let cache: { at: number; value: AppSettings } | null = null;
const TTL_MS = 10_000;

/** Deep-merges stored values over defaults, so new settings keys get sensible values automatically. */
function withDefaults(stored: unknown): AppSettings {
  const s = (stored && typeof stored === "object" ? stored : {}) as Partial<AppSettings>;
  const merged = {
    access: { ...DEFAULT_SETTINGS.access, ...(s.access || {}) },
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
