import { describe, it, expect, afterEach } from "vitest";
import { nameFromGoogle } from "../src/lib/google-auth";
import { googleConfigured, passwordLoginEnabled } from "../src/lib/auth-config";
import { googleErrorMessage } from "../src/lib/auth-messages";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("sign-in switches", () => {
  it("password login stays on until Google is configured", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.PASSWORD_LOGIN;
    expect(googleConfigured()).toBe(false);
    expect(passwordLoginEnabled()).toBe(true);
  });
  it("with Google set up, password login is off unless PASSWORD_LOGIN=on", () => {
    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    delete process.env.PASSWORD_LOGIN;
    expect(passwordLoginEnabled()).toBe(false);
    process.env.PASSWORD_LOGIN = "on";
    expect(passwordLoginEnabled()).toBe(true);
  });
});

describe("Google profile", () => {
  it("uses Google's name, tidied", () => {
    expect(nameFromGoogle({ name: "  Areeba   Khalid " }, "a@x.com")).toBe("Areeba Khalid");
  });
  it("falls back to the email when there's no name", () => {
    expect(nameFromGoogle({ name: "" }, "zain.abbasi@gmail.com")).toBe("Zain abbasi");
  });
  it("friendly messages for next-auth errors", () => {
    expect(googleErrorMessage("GoogleUnverified")).toMatch(/isn't verified/);
    expect(googleErrorMessage("SomethingNew")).toMatch(/Try again/);
    expect(googleErrorMessage(undefined)).toBeNull();
  });
});
