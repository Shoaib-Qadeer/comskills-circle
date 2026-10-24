import { describe, it, expect, beforeAll } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/password";
import { passwordProblem, passwordStrength } from "../src/lib/password-rules";
import { generateCode, hashCode, judgeCode, MAX_CODE_ATTEMPTS, signValue, verifySignedValue } from "../src/lib/codes";
import { budgetAllows, emailCap, scrubAddresses } from "../src/lib/mail";
import { DEFAULT_SETTINGS, settingsSchema, withDefaults } from "../src/lib/settings";
import { accessStatus, isAdminEmail, isTeam } from "../src/lib/auth";
import { statusAfterVerify, signupSchema, FORGOT_REPLY } from "../src/lib/accounts";
import { codeEmail, renderEmail } from "../src/lib/mail-templates";

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "test-secret-test-secret-test-secret-123";
  process.env.ADMIN_EMAILS = "comskills.official@gmail.com, shoaibqadeer0342@gmail.com";
});

describe("passwords", () => {
  it("hashes with scrypt and a random salt, and verifies", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(a).not.toBe(b);
    expect(await verifyPassword("correct horse battery", a)).toBe(true);
    expect(await verifyPassword("correct horse batterY", a)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await verifyPassword("anything", "bcrypt$garbage")).toBe(false);
  });
  it("enforces at least 10 characters and rejects weak ones", () => {
    expect(passwordProblem("short")).toMatch(/10 characters/);
    expect(passwordProblem("1234567890")).toBeTruthy();
    expect(passwordProblem("mango river 42")).toBeNull();
    expect(passwordStrength("Lahore-Tea-Sunrise-7").label).toBe("Strong");
  });
});

describe("email codes", () => {
  const key = "k";
  it("are 6 digits and stored only as a keyed hash", () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^\d{6}$/);
    const h = hashCode("A@B.com", "verify", "123456", key);
    expect(h).not.toContain("123456");
    expect(h).toBe(hashCode("a@b.com", "verify", "123456", key));
    expect(h).not.toBe(hashCode("a@b.com", "reset", "123456", key));
  });
  it("accept the right code once and reject expired ones", () => {
    const doc = { codeHash: hashCode("a@b.com", "verify", "111111", key), attempts: 0, expiresAt: new Date(Date.now() + 60_000) };
    expect(judgeCode(doc, hashCode("a@b.com", "verify", "111111", key))).toMatchObject({ result: "ok", consume: true });
    expect(judgeCode({ ...doc, expiresAt: new Date(Date.now() - 1) }, doc.codeHash).result).toBe("expired");
    expect(judgeCode(null, doc.codeHash).result).toBe("expired");
  });
  it("lock after 5 wrong tries, even if the 6th try is right", () => {
    let doc = { codeHash: hashCode("a@b.com", "verify", "111111", key), attempts: 0, expiresAt: new Date(Date.now() + 60_000) };
    const wrong = hashCode("a@b.com", "verify", "999999", key);
    const results: string[] = [];
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
      const v = judgeCode(doc, wrong);
      results.push(v.result);
      doc = { ...doc, attempts: v.attemptsAfter };
    }
    expect(results).toEqual(["invalid", "invalid", "invalid", "invalid", "locked"]);
    expect(judgeCode(doc, doc.codeHash).result).toBe("locked");
  });
  it("code emails put the code in the subject", () => {
    const m = codeEmail("042917", "verify");
    expect(m.subject).toBe("Your Comskills Circle code: 042917");
    expect(m.text).toContain("042917");
    expect(m.html).not.toContain("Change or stop these emails");
  });
});

describe("enumeration safety", () => {
  it("forgot-password reply never says whether an account exists", () => {
    expect(FORGOT_REPLY).toBe("If that email has an account, we sent a code. Check your inbox (and spam).");
  });
  it("sign-up requires consent and a valid email", () => {
    const ok = { name: "Ayesha Khan", email: "Ayesha@Example.com ", password: "mango river 42", batch: null, saysTeam: false, consent: true };
    const parsed = signupSchema.parse(ok);
    expect(parsed.email).toBe("ayesha@example.com");
    expect(signupSchema.safeParse({ ...ok, consent: false }).success).toBe(false);
    expect(signupSchema.safeParse({ ...ok, email: "nope" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...ok, password: "short" }).success).toBe(false);
  });
});

describe("email budget", () => {
  const email = DEFAULT_SETTINGS.email; // 400 a day, 80 kept for codes
  it("stops normal mail at limit − reserve, but lets codes use the reserve", () => {
    expect(emailCap("digest", email)).toBe(320);
    expect(emailCap("code", email)).toBe(400);
    expect(budgetAllows("digest", 319, email)).toBe(true);
    expect(budgetAllows("digest", 320, email)).toBe(false);
    expect(budgetAllows("announcement", 320, email)).toBe(false);
    expect(budgetAllows("code", 320, email)).toBe(true);
    expect(budgetAllows("code", 399, email)).toBe(true);
    expect(budgetAllows("code", 400, email)).toBe(false);
  });
  it("never logs addresses", () => {
    expect(scrubAddresses("550 5.1.1 <someone@gmail.com>: user unknown")).toBe("550 5.1.1 <[address]>: user unknown");
  });
  it("unsubscribe links are signed", () => {
    const sig = signValue("65f0c0ffee", "k");
    expect(verifySignedValue("65f0c0ffee", sig, "k")).toBe(true);
    expect(verifySignedValue("65f0c0ffef", sig, "k")).toBe(false);
    expect(verifySignedValue("65f0c0ffee", "x", "k")).toBe(false);
  });
  it("templates escape what members write", () => {
    const m = renderEmail({ subject: "s", heading: "<b>hi</b>", blocks: [{ p: "<script>x</script>" }], reason: "r" });
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;b&gt;hi&lt;/b&gt;");
  });
});

describe("roles and approval", () => {
  it("admins come from ADMIN_EMAILS only, and are always approved", () => {
    expect(isAdminEmail("Comskills.Official@gmail.com")).toBe(true);
    expect(isAdminEmail("someone@gmail.com")).toBe(false);
    expect(accessStatus({ email: "shoaibqadeer0342@gmail.com", status: "pending" })).toBe("approved");
    expect(accessStatus({ email: "new@gmail.com" })).toBe("pending");
    expect(accessStatus({ email: "new@gmail.com", status: "rejected" })).toBe("rejected");
  });
  it("team = role team or admin; participants are not team", () => {
    expect(isTeam({ role: "team", email: "x@y.com" })).toBe(true);
    expect(isTeam({ role: "participant", email: "comskills.official@gmail.com" })).toBe(true);
    expect(isTeam({ role: "participant", email: "x@y.com" })).toBe(false);
  });
  it("every new account waits for approval unless admin or pre-approved", () => {
    const s = { access: { requireApproval: true, preApprovedEmails: ["pre@x.com"] } };
    expect(statusAfterVerify("new@x.com", s, "pending")).toBe("pending");
    expect(statusAfterVerify("pre@x.com", s, "pending")).toBe("approved");
    expect(statusAfterVerify("comskills.official@gmail.com", s, "pending")).toBe("approved");
    expect(statusAfterVerify("pre@x.com", s, "rejected")).toBe("rejected");
  });
});

describe("settings", () => {
  it("defaults are valid and match the plan", () => {
    expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
    expect(DEFAULT_SETTINGS.access.requireApproval).toBe(true);
    expect(DEFAULT_SETTINGS.access.preApprovedEmails).toEqual([]);
    expect(DEFAULT_SETTINGS.ai.dailyCallLimit).toBe(450);
    expect(DEFAULT_SETTINGS.email.dailyLimit).toBe(400);
    expect(DEFAULT_SETTINGS.email.reserveForCodes).toBe(80);
    expect(DEFAULT_SETTINGS.email.digestWeekday).toBe(1);
    expect(DEFAULT_SETTINGS.email.monthlyNudge).toBe(false);
    expect(DEFAULT_SETTINGS.limits.connectPerDay).toBe(15);
  });
  it("fills new keys into old stored settings and rejects nonsense", () => {
    const merged = withDefaults({ ai: { model: "x" }, access: { requireApproval: false } });
    expect(merged.ai.model).toBe("x");
    expect(merged.access.requireApproval).toBe(false);
    expect(merged.email.reserveForCodes).toBe(80);
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, ai: { ...DEFAULT_SETTINGS.ai, matchThreshold: 500 } }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, batches: [{ id: "Bad Id", label: "x", archived: false }] }).success).toBe(false);
  });
});
