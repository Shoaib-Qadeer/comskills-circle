// Keeps identities out of anything sent to the AI. Profiles go as u1…uN aliases, and free text is
// scrubbed of emails, phone numbers, links and (when known) the person's name and university.

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// 8+ digits, optionally separated by spaces, dots, dashes, parentheses, with an optional leading +
const PHONE_RE = /(?:\+|00)?\d(?:[\s.\-()]*\d){7,}/g;
const URL_RE = /https?:\/\/\S+/gi;

export function containsContactDetails(text: string | null | undefined): boolean {
  if (!text) return false;
  const withoutUrls = text.replace(URL_RE, " ");
  return new RegExp(EMAIL_RE.source, "i").test(withoutUrls) || new RegExp(PHONE_RE.source).test(withoutUrls);
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Removes contact details and the given identity strings from free text before it reaches the LLM. */
export function scrubForLlm(text: string, who: { name?: string | null; email?: string | null; university?: string | null } = {}): string {
  let t = text.replace(URL_RE, "[link]").replace(EMAIL_RE, "[email]").replace(PHONE_RE, "[phone]");
  if (who.university && who.university.trim().length >= 3) t = t.replace(new RegExp(escapeRe(who.university.trim()), "gi"), "[university]");
  if (who.name) {
    for (const part of who.name.split(/\s+/).filter((p) => p.length >= 3)) {
      t = t.replace(new RegExp(`\\b${escapeRe(part)}\\b`, "gi"), "[name]");
    }
  }
  return t;
}
