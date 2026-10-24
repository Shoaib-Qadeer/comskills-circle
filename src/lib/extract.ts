import { collections } from "./db";
import { generateJSON, LlmUnavailableError } from "./llm";
import { extractionUser, systemPrompt } from "./prompts";
import { getSettings } from "./settings";
import { llmExtractionSchema } from "./schemas";
import { onlyValidFields } from "./taxonomy";
import { normalizeUrl, isHttpUrl } from "./url";
import { safeFetchHtml, parsePage, FetchBlockedError, type ParsedPage } from "./fetch-page";
import type { ExtractedDraft, OppType } from "./types";

const MIN_TEXT = 300;

export type ExtractResult =
  | { kind: "duplicate"; opportunityId: string; postedByName: string | null; createdAt: string }
  | { kind: "needsPaste"; reason: string }
  | { kind: "draft"; draft: ExtractedDraft; llm: boolean };

function validIsoDate(s: string | null): string | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : s;
}

function isoFromAny(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** A draft built without the LLM, from page metadata/JSON-LD only. The user fills in the rest. */
function manualDraft(url: string, page: ParsedPage | null, pasted: string | null): ExtractedDraft {
  const jp = page?.jobPosting as Record<string, unknown> | null | undefined;
  const org = jp?.hiringOrganization as { name?: string } | string | undefined;
  const firstLine = pasted?.split("\n").map((l) => l.trim()).find((l) => l.length > 3) || "";
  return {
    url,
    title: (typeof jp?.title === "string" ? jp.title : "") || page?.titleHint || firstLine.slice(0, 160) || "",
    organization: (typeof org === "string" ? org : org?.name) || page?.siteName || null,
    location: null,
    remote: jp?.jobLocationType === "TELECOMMUTE" ? "remote" : null,
    type: "internship",
    deadline: isoFromAny(jp?.validThrough),
    startDate: null,
    durationMonths: null,
    paid: null,
    frenchRequired: null,
    fields: [],
    tags: [],
    eligibility: null,
    summary: (page?.description || "").slice(0, 600),
  };
}

export async function extractOpportunity(input: { url?: string; pastedText?: string }): Promise<ExtractResult> {
  const rawUrl = input.url?.trim() || "";
  const pasted = input.pastedText?.trim() || "";
  if (rawUrl && !isHttpUrl(rawUrl)) return { kind: "needsPaste", reason: "That doesn't look like a valid link." };

  if (rawUrl) {
    const key = normalizeUrl(rawUrl);
    if (key) {
      const { opportunities, users } = await collections();
      const existing = await opportunities.findOne({ urlKey: key }, { projection: { _id: 1, postedBy: 1, createdAt: 1 } });
      if (existing) {
        const poster = existing.postedBy ? await users.findOne({ _id: existing.postedBy }, { projection: { name: 1 } }) : null;
        return {
          kind: "duplicate",
          opportunityId: String(existing._id),
          postedByName: poster?.name ?? null,
          createdAt: existing.createdAt.toISOString(),
        };
      }
    }
  }

  let page: ParsedPage | null = null;
  let text = pasted;
  if (!text) {
    try {
      const { html } = await safeFetchHtml(rawUrl);
      page = parsePage(html);
      text = page.text;
    } catch (err) {
      const reason =
        err instanceof FetchBlockedError && /not public|Only http/.test(err.message)
          ? "That link can't be opened from here."
          : "This site blocks automatic reading.";
      return { kind: "needsPaste", reason };
    }
    if (text.length < MIN_TEXT) return { kind: "needsPaste", reason: "This site blocks automatic reading." };
  }

  try {
    const settings = await getSettings();
    const out = await generateJSON({
      feature: "extraction",
      label: "extract",
      system: await systemPrompt("extraction"),
      user: extractionUser({
        url: rawUrl || null,
        titleHint: page?.titleHint || "",
        jsonLd: page?.jsonLdSummary || "",
        text: text.slice(0, settings.ai.extractionChars),
        today: new Date().toISOString().slice(0, 10),
      }),
      schema: llmExtractionSchema,
      maxOutputTokens: 1500,
    });
    const draft: ExtractedDraft = {
      url: rawUrl,
      title: out.title,
      organization: out.organization,
      location: out.location,
      remote: out.remote,
      type: out.type as OppType,
      deadline: validIsoDate(out.deadline),
      startDate: validIsoDate(out.startDate),
      durationMonths: out.durationMonths,
      paid: out.paid,
      frenchRequired: out.frenchRequired,
      fields: onlyValidFields(out.fields),
      tags: out.tags,
      eligibility: out.eligibility,
      summary: out.summary,
    };
    return { kind: "draft", draft, llm: true };
  } catch (err) {
    if (!(err instanceof LlmUnavailableError)) console.error("[extract]", err);
    return { kind: "draft", draft: manualDraft(rawUrl, page, pasted || null), llm: false };
  }
}
