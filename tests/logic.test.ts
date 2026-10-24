import { describe, it, expect } from "vitest";
import { normalizeUrl, isPrivateIp, isHttpUrl } from "../src/lib/url";
import { computeWarnings, daysUntil, isExpired } from "../src/lib/warnings";
import { fallbackScore } from "../src/lib/fallback-match";
import { containsContactDetails } from "../src/lib/pii";
import { parseJsonLoose } from "../src/lib/llm";
import { llmExtractionSchema } from "../src/lib/schemas";
import { parsePage } from "../src/lib/fetch-page";

const NOW = new Date("2026-10-17T10:00:00Z");

describe("normalizeUrl (duplicate detection)", () => {
  it("treats tracking params, fragments, www, trailing slash and http/https as the same link", () => {
    const a = normalizeUrl("https://www.Example.org/jobs/123/?utm_source=x&utm_medium=y#apply");
    const b = normalizeUrl("http://example.org/jobs/123");
    expect(a).toBe("https://example.org/jobs/123");
    expect(a).toBe(b);
  });
  it("keeps meaningful query params, order-independent", () => {
    expect(normalizeUrl("https://x.com/p?id=2&lang=en")).toBe(normalizeUrl("https://x.com/p?lang=en&id=2&fbclid=abc"));
    expect(normalizeUrl("https://x.com/p?id=2")).not.toBe(normalizeUrl("https://x.com/p?id=3"));
  });
  it("rejects non-http links", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("isPrivateIp (SSRF guard)", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "blocks %s",
    (ip) => expect(isPrivateIp(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "142.250.74.14", "2a00:1450:4007:80b::200e"])("allows %s", (ip) => expect(isPrivateIp(ip)).toBe(false));
});

describe("warnings", () => {
  const base = { deadline: null, durationMonths: 6, frenchRequired: false, paid: true, type: "internship" };
  it("flags a 3-month internship", () => {
    const w = computeWarnings({ ...base, deadline: "2026-12-01", durationMonths: 3 }, NOW);
    expect(w.map((x) => x.label)).toContain("Duration: 3 months (M1 needs 6)");
  });
  it("accepts 5.5–6.5 months", () => {
    const w = computeWarnings({ ...base, deadline: "2026-12-01", durationMonths: 5.5 }, NOW);
    expect(w.find((x) => x.kind === "duration_mismatch")).toBeUndefined();
  });
  it("urgent under 3 days, soon under 14, nothing beyond", () => {
    expect(computeWarnings({ ...base, deadline: "2026-10-19" }, NOW)[0]).toEqual({ kind: "deadline_urgent", label: "⏳ Deadline in 2 days" });
    expect(computeWarnings({ ...base, deadline: "2026-10-26" }, NOW)[0].kind).toBe("deadline_soon");
    expect(computeWarnings({ ...base, deadline: "2026-12-26" }, NOW)).toEqual([]);
  });
  it("flags French, unknowns and unpaid", () => {
    const kinds = computeWarnings({ deadline: null, durationMonths: null, frenchRequired: true, paid: false, type: "internship" }, NOW).map((w) => w.kind);
    expect(kinds).toEqual(["deadline_unknown", "french_required", "duration_unknown", "unpaid"]);
  });
  it("does not apply duration rules to events", () => {
    expect(computeWarnings({ ...base, deadline: "2026-12-01", durationMonths: null, type: "event" }, NOW)).toEqual([]);
  });
  it("expiry is day-based", () => {
    expect(daysUntil("2026-10-17", NOW)).toBe(0);
    expect(isExpired("2026-10-17", NOW)).toBe(false);
    expect(isExpired("2026-10-16", NOW)).toBe(true);
  });
});

describe("fallback matcher", () => {
  const opp = { fields: ["digital-health", "ai-ml"], tags: ["nlp"], title: "ML intern in digital health", summary: "Build models.", location: "Paris", remote: "hybrid" };
  it("scores a digital-health person high and an ecology-only person low", () => {
    const dh = fallbackScore({ fields: ["digital-health", "ai-ml"], targetRoles: ["ML intern"], preferredLocations: ["Paris"] }, opp);
    const eco = fallbackScore({ fields: ["ecology"], targetRoles: ["field work"], preferredLocations: ["Lyon"] }, opp);
    expect(dh.score).toBeGreaterThanOrEqual(60);
    expect(dh.reason).toContain("Digital Health");
    expect(eco.score).toBeLessThan(60);
  });
});

describe("contact-detail detection", () => {
  it("rejects emails and phone numbers", () => {
    expect(containsContactDetails("reach her at jane.doe@uni.fr")).toBe(true);
    expect(containsContactDetails("+33 6 12 34 56 78")).toBe(true);
    expect(containsContactDetails("06.12.34.56.78")).toBe(true);
  });
  it("allows normal text and LinkedIn URLs with digits", () => {
    expect(containsContactDetails("Postdoc in neuropsychology, Paris 2025")).toBe(false);
    expect(containsContactDetails("https://www.linkedin.com/in/jane-doe-12345678")).toBe(false);
  });
});

describe("LLM output handling", () => {
  it("parses fenced / chatty JSON", () => {
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonLoose('Sure! Here it is: {"a":2} hope that helps')).toEqual({ a: 2 });
  });
  it("coerces bad values to null instead of failing", () => {
    const out = llmExtractionSchema.parse({
      title: "  Research intern  ", organization: "", remote: "sometimes", type: "gig", deadline: "next Friday",
      durationMonths: "six", paid: "yes", frenchRequired: null, fields: ["ai-ml"], tags: ["NLP"], summary: "x",
    });
    expect(out).toMatchObject({ title: "Research intern", organization: null, remote: null, type: "other", deadline: null, durationMonths: null, paid: null, tags: ["nlp"] });
  });
});

describe("page parsing", () => {
  it("reads og:title and JSON-LD JobPosting", () => {
    const html = `<html><head><title>T</title><meta property="og:title" content="ML Intern – Lab X">
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"JobPosting","title":"ML Intern","hiringOrganization":{"name":"Lab X"},"validThrough":"2026-11-30","jobLocation":{"address":{"addressLocality":"Paris","addressCountry":"FR"}},"description":"<p>We are looking for an intern for six months to work on machine learning for health.</p>"}</script>
      </head><body><article><h1>ML Intern</h1><p>${"Lorem ipsum dolor sit amet. ".repeat(20)}</p></article></body></html>`;
    const p = parsePage(html);
    expect(p.titleHint).toBe("ML Intern – Lab X");
    expect(p.jsonLdSummary).toContain("organization: Lab X");
    expect(p.jsonLdSummary).toContain("validThrough: 2026-11-30");
    expect(p.text).toContain("six months");
  });
});
