import { describe, it, expect } from "vitest";
import { STARTER_OPPORTUNITIES } from "../src/lib/starter-opportunities";
import { starterKey } from "../src/lib/starter-import";
import { isFieldSlug } from "../src/lib/taxonomy";
import { isHttpUrl } from "../src/lib/url";
import { DEFAULT_SETTINGS, settingsSchema } from "../src/lib/settings";
import { accessStatus, isAdminEmail, isAllowedEmail } from "../src/lib/auth";
import { opportunityInputSchema, llmCoachSchema } from "../src/lib/schemas";

describe("starter opportunities", () => {
  it("has 2–3 items for each requested theme", () => {
    const byDomain = new Map<string, number>();
    STARTER_OPPORTUNITIES.forEach((s) => byDomain.set(s.domain, (byDomain.get(s.domain) ?? 0) + 1));
    expect(byDomain.size).toBe(12);
    for (const [, n] of byDomain) expect(n).toBeGreaterThanOrEqual(2);
  });
  it("every item is complete and valid", () => {
    const ids = new Set<string>();
    for (const s of STARTER_OPPORTUNITIES) {
      expect(ids.has(s.id)).toBe(false);
      ids.add(s.id);
      expect(isHttpUrl(s.url)).toBe(true);
      expect(s.fields.length).toBeGreaterThan(0);
      expect(s.fields.length).toBeLessThanOrEqual(4);
      s.fields.forEach((f) => expect(isFieldSlug(f), `${s.id}: ${f}`).toBe(true));
      expect(s.summary.length).toBeGreaterThan(60);
      expect(s.eligibility.length).toBeGreaterThan(20);
      expect(s.organization && s.location).toBeTruthy();
      // passes the same validation as a classmate's post
      const r = opportunityInputSchema.safeParse({ ...s, eligibility: s.eligibility.slice(0, 240) });
      expect(r.success, `${s.id}: ${r.success ? "" : r.error.message}`).toBe(true);
    }
  });
  it("items sharing a listing page still get distinct duplicate keys", () => {
    const keys = STARTER_OPPORTUNITIES.map(starterKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("settings", () => {
  it("defaults are valid and give a generous AI budget", () => {
    expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
    expect(DEFAULT_SETTINGS.access.requireApproval).toBe(true);
    expect(DEFAULT_SETTINGS.ai.dailyTokenLimit).toBe(1_000_000);
  });
  it("rejects nonsense values", () => {
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, ai: { ...DEFAULT_SETTINGS.ai, matchThreshold: 500 } }).success).toBe(false);
    const bad = { ...DEFAULT_SETTINGS, access: { ...DEFAULT_SETTINGS.access, preApprovedEmails: ["not-an-email"] } };
    expect(settingsSchema.safeParse(bad).success).toBe(false);
  });
});

describe("access", () => {
  it("treats accounts from before approvals as approved, and admins as always approved", () => {
    expect(accessStatus({ email: "old@learningplanetinstitute.org" })).toBe("approved");
    expect(accessStatus({ email: "new@learningplanetinstitute.org", status: "pending" })).toBe("pending");
    expect(accessStatus({ email: "shoaib.qadeer@learningplanetinstitute.org", status: "pending" })).toBe("approved");
  });
  it("admin is only Shoaib by default", () => {
    expect(isAdminEmail("Shoaib.Qadeer@learningplanetinstitute.org")).toBe(true);
    expect(isAdminEmail("someone.else@learningplanetinstitute.org")).toBe(false);
  });
  it("extra allowed emails can sign in from other domains", () => {
    expect(isAllowedEmail("friend@u-paris.fr", true)).toBe(false);
    expect(isAllowedEmail("friend@u-paris.fr", true, ["friend@u-paris.fr"])).toBe(true);
  });
});

describe("coach output", () => {
  it("trims and caps lists", () => {
    const out = llmCoachSchema.parse({ whyYou: " Fits. ", highlight: ["a", "b", "c", "d", "e"], gaps: "none", firstStep: "Email the lab." });
    expect(out.whyYou).toBe("Fits.");
    expect(out.highlight).toHaveLength(4);
    expect(out.gaps).toEqual([]);
  });
});
