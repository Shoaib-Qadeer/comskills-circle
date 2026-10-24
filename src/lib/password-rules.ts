// Password rules shared by the sign-up form and the server. No Node imports, so it's client-safe.

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;

const COMMON = [
  "password",
  "123456",
  "qwerty",
  "letmein",
  "comskills",
  "pakistan",
  "iloveyou",
  "welcome",
  "admin",
  "abc123",
];

export type Strength = { score: 0 | 1 | 2 | 3; label: "Too short" | "Weak" | "Okay" | "Strong"; hint: string };

/** Passwords made only of a common word, one repeated character, or digits. */
export function isTooPredictable(pw: string): boolean {
  const lower = pw.toLowerCase();
  const bare = lower.replace(/[^a-z0-9]/g, "");
  // e.g. "password", "Password123!", "comskills2026" — a common word plus only digits
  const commonPlusDigits = COMMON.some((c) => bare.startsWith(c) && /^\d*$/.test(bare.slice(c.length)));
  return commonPlusDigits || /^(.)\1+$/.test(pw) || /^\d+$/.test(pw);
}

export function passwordStrength(pw: string): Strength {
  if (pw.length < PASSWORD_MIN) {
    return { score: 0, label: "Too short", hint: `Use at least ${PASSWORD_MIN} characters.` };
  }
  const lower = pw.toLowerCase();
  if (isTooPredictable(pw) || COMMON.some((c) => lower.includes(c))) {
    return { score: 1, label: "Weak", hint: "Avoid common words and number-only passwords." };
  }
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  if (pw.length >= 14 && variety >= 2) return { score: 3, label: "Strong", hint: "Nice." };
  if (variety >= 3 || pw.length >= 16) return { score: 3, label: "Strong", hint: "Nice." };
  if (variety >= 2) return { score: 2, label: "Okay", hint: "A few more characters would make it stronger." };
  return { score: 1, label: "Weak", hint: "Mix letters with numbers or symbols, or use a longer phrase." };
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (pw.length > PASSWORD_MAX) return "That password is too long.";
  if (isTooPredictable(pw)) return "That password is too easy to guess. Try a short phrase instead.";
  return null;
}
