import { describe, it, expect, beforeAll } from "vitest";
import { ObjectId } from "mongodb";
import { memberCardDTO, memberProfileDTO, meDTO } from "../src/lib/serialize";
import { canSeeContacts, pairKey, scholarshipVisibleTo, isListedMember } from "../src/lib/visibility";
import { deriveConnectState } from "../src/lib/connect";
import { scrubForLlm } from "../src/lib/pii";
import { profileForLlm } from "../src/lib/matching";
import { normalizeWhatsapp, waMeLink, waShareLink } from "../src/lib/phone";
import { newUserDoc } from "../src/lib/accounts";
import { profileUpdateSchema } from "../src/lib/schemas";
import type { ConnectState, UserDoc } from "../src/lib/types";

beforeAll(() => {
  process.env.ADMIN_EMAILS = "comskills.official@gmail.com";
});

function member(over: Partial<UserDoc> = {}): UserDoc {
  const now = new Date("2026-10-01T00:00:00Z");
  return {
    _id: new ObjectId(),
    ...newUserDoc({ name: "Sana Malik", email: "sana.malik@gmail.com", passwordHash: "x", batch: null, saysTeam: false, now }),
    emailVerifiedAt: now,
    status: "approved",
    onboarded: true,
    university: "University of the Punjab",
    city: "Lahore",
    whatsapp: "+923001234567",
    contactEmail: "sana.contact@gmail.com",
    fieldOfStudy: "BS Biotechnology",
    skills: ["PCR", "Python"],
    experience: "At University of the Punjab I worked on PCR for antibiotic resistance. Sana Malik's lab notebook is public.",
    lookingForNote: "A funded master's in Europe, see https://github.com/sana",
    ...over,
  } as UserDoc;
}

const owner = member();
const stranger = { _id: new ObjectId(), isAdmin: false };
const admin = { _id: new ObjectId(), isAdmin: true };
const ctx = (state: ConnectState["state"]) => ({ connect: { state } as ConnectState, settings: null });

describe("contact reveal (memberProfileDTO)", () => {
  it("hides WhatsApp and email from members who aren't connected", () => {
    for (const s of ["none", "outgoing", "incoming", "declined"] as const) {
      const dto = memberProfileDTO(owner, stranger, ctx(s));
      expect(dto.contacts, s).toBeNull();
      expect(JSON.stringify(dto)).not.toContain("+923001234567");
      expect(JSON.stringify(dto)).not.toContain("sana.contact@gmail.com");
      expect(JSON.stringify(dto)).not.toContain("sana.malik@gmail.com"); // sign-in email never leaks either
    }
  });
  it("shows them after an accepted connect request", () => {
    expect(memberProfileDTO(owner, stranger, ctx("connected")).contacts).toEqual({ whatsapp: "+923001234567", email: "sana.contact@gmail.com" });
  });
  it("shows them to the owner and to admins", () => {
    expect(memberProfileDTO(owner, { _id: owner._id, isAdmin: false }, ctx("self")).contacts?.whatsapp).toBe("+923001234567");
    expect(memberProfileDTO(owner, admin, ctx("none")).contacts?.email).toBe("sana.contact@gmail.com");
  });
  it("falls back to the sign-in email only once contacts are allowed", () => {
    const noContactEmail = member({ contactEmail: null });
    expect(memberProfileDTO(noContactEmail, stranger, ctx("connected")).contacts?.email).toBe("sana.malik@gmail.com");
    expect(memberProfileDTO(noContactEmail, stranger, ctx("none")).contacts).toBeNull();
  });
  it("cards never carry contacts or the password hash", () => {
    const json = JSON.stringify(memberCardDTO(owner, stranger._id, null));
    expect(json).not.toMatch(/whatsapp|contactEmail|passwordHash|\+92300|@gmail/);
    expect(JSON.stringify(meDTO(owner))).not.toContain("passwordHash");
  });
  it("team members follow the same rule", () => {
    expect(canSeeContacts({ id: "t", isAdmin: false, isTeam: true }, "o", false)).toBe(false);
    expect(canSeeContacts({ id: "t", isAdmin: false, isTeam: true }, "o", true)).toBe(true);
  });
});

describe("connect state", () => {
  const me = "a", them = "b";
  it("is connected once any request between the two is accepted", () => {
    expect(deriveConnectState(me, [{ id: "1", from: them, to: me, status: "accepted", message: "" }]).state).toBe("connected");
  });
  it("tells outgoing from incoming", () => {
    expect(deriveConnectState(me, [{ id: "1", from: me, to: them, status: "pending", message: "" }])).toEqual({ state: "outgoing", requestId: "1" });
    expect(deriveConnectState(me, [{ id: "2", from: them, to: me, status: "pending", message: "hi" }])).toEqual({ state: "incoming", requestId: "2", message: "hi" });
  });
  it("only the requester sees 'declined'", () => {
    const reqs = [{ id: "1", from: me, to: them, status: "declined" as const, message: "" }];
    expect(deriveConnectState(me, reqs).state).toBe("declined");
    expect(deriveConnectState(them, reqs).state).toBe("none");
  });
  it("pair keys are order-independent", () => {
    expect(pairKey("x", "y")).toBe(pairKey("y", "x"));
  });
});

describe("listing", () => {
  it("pending, declined, unverified or un-onboarded people never appear", () => {
    expect(isListedMember({ status: "approved", onboarded: true, emailVerifiedAt: new Date() })).toBe(true);
    expect(isListedMember({ status: "pending", onboarded: true, emailVerifiedAt: new Date() })).toBe(false);
    expect(isListedMember({ status: "rejected", onboarded: true, emailVerifiedAt: new Date() })).toBe(false);
    expect(isListedMember({ status: "approved", onboarded: false, emailVerifiedAt: new Date() })).toBe(false);
    expect(isListedMember({ status: "approved", onboarded: true, emailVerifiedAt: null })).toBe(false);
  });
});

describe("scholarship visibility", () => {
  const viewer = { id: "v", isAdmin: false, isTeam: false };
  const team = { id: "t", isAdmin: false, isTeam: true };
  it("hides team-only rejections from other members, but not from the owner or the team", () => {
    const e = { userId: "o", stage: "rejected", rejectedVisibility: "team" as const };
    expect(scholarshipVisibleTo(e, viewer)).toBe(false);
    expect(scholarshipVisibleTo(e, { id: "o", isAdmin: false })).toBe(true);
    expect(scholarshipVisibleTo(e, team)).toBe(true);
    expect(scholarshipVisibleTo(e, { id: "x", isAdmin: true })).toBe(true);
  });
  it("shows rejections the owner made public, and every other stage", () => {
    expect(scholarshipVisibleTo({ userId: "o", stage: "rejected", rejectedVisibility: "members" }, viewer)).toBe(true);
    for (const stage of ["applying", "applied", "accepted"]) expect(scholarshipVisibleTo({ userId: "o", stage, rejectedVisibility: "team" }, viewer)).toBe(true);
  });
});

describe("AI never sees identities", () => {
  it("scrubs emails, phones, links, the name and the university from free text", () => {
    const raw = "At University of the Punjab I worked on PCR. Reach me at sana.malik@gmail.com or 0300 1234567. Sana Malik.";
    const t = scrubForLlm(raw, { name: owner.name, email: owner.email, university: owner.university });
    expect(t).not.toMatch(/sana|malik|gmail|0300|punjab/i);
    expect(t).toContain("[email]");
    expect(t).toContain("[phone]");
    expect(t).toContain("[university]");
  });
  it("profiles sent to the matcher carry an alias and no identity fields", () => {
    const p = profileForLlm(owner, "u7");
    const json = JSON.stringify(p);
    expect(p.id).toBe("u7");
    expect(json).not.toMatch(/Sana|Malik|gmail|\+92|0300|Punjab|github\.com|whatsapp|contact/i);
    expect(p.skills).toEqual(["PCR", "Python"]);
  });
});

describe("public profile text", () => {
  it("refuses phone numbers and emails in text everyone can read", () => {
    expect(profileUpdateSchema.safeParse({ experience: "Call me on 0300 1234567" }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ lookingForNote: "mail sana@x.com" }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ experience: "Built a 3-layer CNN in 2025 with 98.5% accuracy" }).success).toBe(true);
  });
});

describe("WhatsApp numbers", () => {
  it("normalises Pakistani and international formats to E.164", () => {
    expect(normalizeWhatsapp("0300 1234567")).toBe("+923001234567");
    expect(normalizeWhatsapp("0092-300-1234567")).toBe("+923001234567");
    expect(normalizeWhatsapp("923001234567")).toBe("+923001234567");
    expect(normalizeWhatsapp("+44 7700 900123")).toBe("+447700900123");
    expect(normalizeWhatsapp("call me")).toBeNull();
    expect(normalizeWhatsapp("12345")).toBeNull();
  });
  it("builds wa.me links (no API, just links)", () => {
    expect(waMeLink("+923001234567")).toBe("https://wa.me/923001234567");
    expect(waShareLink("New project: Dengue map https://x.y/p/1")).toBe("https://wa.me/?text=New%20project%3A%20Dengue%20map%20https%3A%2F%2Fx.y%2Fp%2F1");
  });
  it("the profile schema rejects bad numbers and stores good ones as E.164", () => {
    expect(profileUpdateSchema.parse({ whatsapp: "0321-7654321" }).whatsapp).toBe("+923217654321");
    expect(profileUpdateSchema.safeParse({ whatsapp: "abc" }).success).toBe(false);
    expect(profileUpdateSchema.parse({ whatsapp: "" }).whatsapp).toBeNull();
  });
});
