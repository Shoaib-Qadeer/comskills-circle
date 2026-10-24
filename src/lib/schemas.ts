import { z } from "zod";
import { isHttpUrl } from "./url";
import { containsContactDetails } from "./pii";

const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => isHttpUrl(v), "must be a valid http(s) link");
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || isHttpUrl(v), "must be a valid http(s) link");

const shortList = (max: number, len = 60) => z.array(z.string().trim().min(1).max(len)).max(max);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, "use YYYY-MM-DD")
  .nullable();

export const visibilitySchema = z.enum(["private", "class", "open"]);
export const remoteSchema = z.enum(["onsite", "hybrid", "remote"]);
export const oppTypeSchema = z.enum(["internship", "fellowship", "summer_school", "competition", "event", "job", "other"]);

export const profileUpdateSchema = z
  .object({
    visibility: visibilitySchema,
    headline: z.string().trim().max(80),
    summary: z.string().trim().max(800),
    fields: shortList(6, 40),
    freeTags: shortList(8, 40),
    targetRoles: shortList(6, 60),
    preferredLocations: shortList(8, 60),
    openToFrench: z.boolean(),
    skillsOffered: shortList(10, 40),
    collaborateOn: z.string().trim().max(200),
    links: z.object({ linkedin: optionalUrl, cv: optionalUrl, portfolio: optionalUrl, github: optionalUrl }),
    onboarded: z.boolean(),
  })
  .partial();

export const extractRequestSchema = z
  .object({
    url: z.string().trim().max(1000).optional(),
    pastedText: z.string().max(30_000).optional(),
  })
  .refine((v) => (v.url && v.url.length > 0) || (v.pastedText && v.pastedText.trim().length > 0), "Paste a link or the posting text");

export const opportunityInputSchema = z.object({
  url: httpUrl,
  title: z.string().trim().min(2).max(160),
  organization: z.string().trim().max(120).nullable(),
  location: z.string().trim().max(120).nullable(),
  remote: remoteSchema.nullable(),
  type: oppTypeSchema,
  deadline: isoDate,
  startDate: isoDate,
  durationMonths: z.number().min(0).max(60).nullable(),
  paid: z.boolean().nullable(),
  frenchRequired: z.boolean().nullable(),
  fields: shortList(4, 40),
  tags: shortList(6, 40),
  eligibility: z.string().trim().max(240).nullable(),
  summary: z.string().trim().max(600),
});

export const publishSchema = opportunityInputSchema.extend({
  taggedFor: z.array(z.string()).max(19).default([]),
  posterNote: z.string().trim().max(200).nullable().default(null),
});

export const opportunityPatchSchema = opportunityInputSchema.partial().extend({
  posterNote: z.string().trim().max(200).nullable().optional(),
});

export const matchPatchSchema = z.object({
  seen: z.boolean().optional(),
  saved: z.boolean().optional(),
  dismissed: z.boolean().optional(),
});

const noContact = (label: string) =>
  z
    .string()
    .trim()
    .max(240)
    .nullable()
    .refine((v) => !containsContactDetails(v), `${label}: please share only a public profile link, not phone numbers or emails`);

export const connectionInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .refine((v) => !containsContactDetails(v), "Please share only a public profile link, not phone numbers or emails"),
  role: noContact("Role"),
  organization: noContact("Organization"),
  location: noContact("Location"),
  fields: shortList(4, 40).min(1, "Pick at least one field"),
  linkedin: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .refine((v) => v === null || v === "" || isHttpUrl(v), "LinkedIn must be a public profile link"),
  contactPreference: z.enum(["direct", "ask_first"]),
  note: noContact("Note"),
  consent: z.literal(true, { error: "Please confirm this is a public profile or the person agreed to be listed" }),
});

export const introRequestSchema = z.object({
  connectionId: z.string(),
  message: z.string().trim().min(10, "Add a short message (at least 10 characters)").max(500),
});

export const introPatchSchema = z.object({ status: z.enum(["accepted", "declined", "done"]) });

/* ---------------- LLM output schemas (lenient: bad values become null) ---------------- */

const nullableStr = (max: number) =>
  z
    .string()
    .transform((s) => s.trim().slice(0, max))
    .nullable()
    .optional()
    .catch(null)
    .transform((v) => (v ? v : null));

export const llmExtractionSchema = z.object({
  title: z.string().min(1).transform((s) => s.trim().slice(0, 160)),
  organization: nullableStr(120),
  location: nullableStr(120),
  remote: remoteSchema.nullable().optional().catch(null).transform((v) => v ?? null),
  type: oppTypeSchema.catch("other"),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().catch(null).transform((v) => v ?? null),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().catch(null).transform((v) => v ?? null),
  durationMonths: z.number().min(0).max(60).nullable().optional().catch(null).transform((v) => v ?? null),
  paid: z.boolean().nullable().optional().catch(null).transform((v) => v ?? null),
  frenchRequired: z.boolean().nullable().optional().catch(null).transform((v) => v ?? null),
  fields: z.array(z.string()).catch([]).transform((a) => a.slice(0, 4)),
  tags: z.array(z.string()).catch([]).transform((a) => a.map((t) => t.toLowerCase().trim().slice(0, 40)).filter(Boolean).slice(0, 6)),
  eligibility: nullableStr(240),
  summary: z.string().catch("").transform((s) => s.trim().slice(0, 600)),
});

export const llmScoresSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      score: z.number().min(0).max(100),
      reason: z.string().transform((s) => s.trim().slice(0, 220)),
    }),
  ),
});

export const llmProfileSchema = z.object({
  fields: z.array(z.string()).catch([]),
  freeTags: z.array(z.string()).catch([]),
  targetRoles: z.array(z.string()).catch([]),
});

export const llmCoachSchema = z.object({
  whyYou: z.string().transform((s) => s.trim().slice(0, 400)),
  highlight: z.array(z.string()).catch([]).transform((a) => a.map((x) => x.trim().slice(0, 200)).filter(Boolean).slice(0, 4)),
  gaps: z.array(z.string()).catch([]).transform((a) => a.map((x) => x.trim().slice(0, 200)).filter(Boolean).slice(0, 3)),
  firstStep: z.string().catch("").transform((s) => s.trim().slice(0, 300)),
});
