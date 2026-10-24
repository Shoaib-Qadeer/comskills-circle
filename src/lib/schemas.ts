import { z } from "zod";
import { isHttpUrl } from "./url";
import { normalizeWhatsapp } from "./phone";
import { containsContactDetails } from "./pii";
import { LOOKING_FOR_VALUES, VOLUNTEER_AREAS, type LookingFor } from "./taxonomy";

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

export const remoteSchema = z.enum(["onsite", "hybrid", "remote"]);
export const oppTypeSchema = z.enum(["scholarship", "fellowship", "internship", "job", "research", "exchange", "summer_school", "competition", "event", "other"]);
export const degreeLevelSchema = z.enum(["bachelor", "master", "phd", "postdoc", "any"]);
export const fundingSchema = z.enum(["full", "partial", "none"]);

const freeChips = (max: number, len = 40) =>
  z
    .array(z.string().trim().min(1).max(len))
    .max(max)
    .transform((a) => Array.from(new Map(a.map((x) => [x.toLowerCase(), x])).values()));

export const whatsappSchema = z
  .string()
  .trim()
  .max(30)
  .nullable()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = normalizeWhatsapp(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Enter a WhatsApp number like 0300 1234567 or +44 7700 900123" });
      return z.NEVER;
    }
    return n;
  });

export const volunteeringSchema = z.object({
  open: z.boolean(),
  for: z.enum(["comskills", "other", "both"]).nullable(),
  areas: z.array(z.enum(VOLUNTEER_AREAS)).max(VOLUNTEER_AREAS.length).transform((a) => Array.from(new Set(a))),
  hoursPerMonth: z.number().int().min(0).max(200).nullable(),
});

export const notifySchema = z.object({
  digest: z.enum(["weekly", "daily", "off"]),
  instant: z.object({ interest: z.boolean(), teamUpdates: z.boolean(), connect: z.boolean(), pinned: z.boolean(), invites: z.boolean() }),
});

/** Text every member can read: no phone numbers or emails (those belong in the private contact fields). */
const publicText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((v) => !containsContactDetails(v), "Please don't put phone numbers or emails here. Add them under contacts: only people you connect with see those.");

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name").max(80),
    university: z.string().trim().max(120),
    city: z.string().trim().max(80),
    country: z.string().trim().max(80),
    whatsapp: whatsappSchema,
    contactEmail: z.string().trim().toLowerCase().max(200).email("Enter a valid contact email").nullable().or(z.literal("").transform(() => null)),
    fieldOfStudy: z.string().trim().max(120),
    skills: freeChips(15),
    tools: freeChips(15),
    experience: publicText(1200),
    links: z.object({ linkedin: optionalUrl, github: optionalUrl, portfolio: optionalUrl }),
    lookingFor: z.array(z.enum(LOOKING_FOR_VALUES as [LookingFor, ...LookingFor[]])).max(5).transform((a) => Array.from(new Set(a))),
    lookingForNote: publicText(400),
    volunteering: volunteeringSchema,
    fields: shortList(6, 40),
    freeTags: freeChips(8),
    onboarded: z.boolean(),
  })
  .partial();

/** What must be filled in before onboarding can finish. */
export function onboardingProblems(p: { university: string; city: string; fieldOfStudy: string; skills: string[]; fields: string[] }): string[] {
  const out: string[] = [];
  if (!p.university.trim()) out.push("Add your university.");
  if (!p.city.trim()) out.push("Add your city.");
  if (!p.fieldOfStudy.trim()) out.push("Add your field of study.");
  if (!p.skills.length) out.push("Add at least one skill.");
  if (!p.fields.length) out.push("Pick at least one field so we can match you.");
  return out;
}

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
  country: z.string().trim().max(80).nullable().default(null),
  degreeLevel: z.array(degreeLevelSchema).max(5).default([]).transform((a) => Array.from(new Set(a))),
  funding: fundingSchema.nullable().default(null),
  deadline: isoDate,
  startDate: isoDate,
  durationMonths: z.number().min(0).max(60).nullable(),
  paid: z.boolean().nullable(),
  fields: shortList(4, 40),
  tags: shortList(6, 40),
  eligibility: z.string().trim().max(240).nullable(),
  summary: z.string().trim().max(600),
});

export const publishSchema = opportunityInputSchema.extend({
  taggedFor: z.array(z.string()).max(20).default([]),
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
  country: nullableStr(80),
  degreeLevel: z
    .array(z.string())
    .catch([])
    .transform((a) => Array.from(new Set(a.map((x) => x.toLowerCase().trim()).filter((x): x is z.infer<typeof degreeLevelSchema> => degreeLevelSchema.safeParse(x).success)))),
  funding: fundingSchema.nullable().optional().catch(null).transform((v) => v ?? null),
  durationMonths: z.number().min(0).max(60).nullable().optional().catch(null).transform((v) => v ?? null),
  paid: z.boolean().nullable().optional().catch(null).transform((v) => v ?? null),
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
});

export const llmCoachSchema = z.object({
  whyYou: z.string().transform((s) => s.trim().slice(0, 400)),
  highlight: z.array(z.string()).catch([]).transform((a) => a.map((x) => x.trim().slice(0, 200)).filter(Boolean).slice(0, 4)),
  gaps: z.array(z.string()).catch([]).transform((a) => a.map((x) => x.trim().slice(0, 200)).filter(Boolean).slice(0, 3)),
  firstStep: z.string().catch("").transform((s) => s.trim().slice(0, 300)),
});
