import { describe, it, expect } from "vitest";
import { volunteerMatches, parseVolunteerFilters } from "../src/lib/volunteers";

const v = (open: boolean, f: "comskills" | "other" | "both" | null, areas: string[], hours: number | null, batch: string | null = "b1") => ({ volunteering: { open, for: f, areas, hoursPerMonth: hours }, batch });
const base = parseVolunteerFilters("http://x/api/team/volunteers");

describe("volunteer filters", () => {
  it("defaults to people who are open", () => {
    expect(base).toEqual({ openOnly: true, for: null, area: null, minHours: null, batch: null });
    expect(volunteerMatches(v(true, "comskills", [], 4), base)).toBe(true);
    expect(volunteerMatches(v(false, "comskills", [], 4), base)).toBe(false);
    expect(volunteerMatches(v(false, "comskills", [], 4), parseVolunteerFilters("http://x/?all=1"))).toBe(true);
  });
  it("'for Comskills' includes people who said both", () => {
    const f = parseVolunteerFilters("http://x/?for=comskills");
    expect(volunteerMatches(v(true, "both", [], 4), f)).toBe(true);
    expect(volunteerMatches(v(true, "other", [], 4), f)).toBe(false);
    expect(volunteerMatches(v(true, "comskills", [], 4), parseVolunteerFilters("http://x/?for=both"))).toBe(false);
  });
  it("area, minimum hours and batch", () => {
    const f = parseVolunteerFilters("http://x/?area=Mentoring&minHours=4&batch=b1");
    expect(volunteerMatches(v(true, "both", ["Mentoring"], 6), f)).toBe(true);
    expect(volunteerMatches(v(true, "both", ["Mentoring"], 2), f)).toBe(false);
    expect(volunteerMatches(v(true, "both", ["Outreach"], 6), f)).toBe(false);
    expect(volunteerMatches(v(true, "both", ["Mentoring"], 6, "b2"), f)).toBe(false);
    expect(parseVolunteerFilters("http://x/?minHours=abc&for=evil").minHours).toBeNull();
  });
});
