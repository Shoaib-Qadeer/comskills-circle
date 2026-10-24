// Detects contact details we don't allow in the shared Connections list (only public profile links are OK).

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
// 8+ digits, optionally separated by spaces, dots, dashes, parentheses, with optional leading +
const PHONE_RE = /(?:\+|00)?\d(?:[\s.\-()]*\d){7,}/;

export function containsContactDetails(text: string | null | undefined): boolean {
  if (!text) return false;
  // ignore digits inside URLs (LinkedIn IDs etc.)
  const withoutUrls = text.replace(/https?:\/\/\S+/gi, " ");
  return EMAIL_RE.test(withoutUrls) || PHONE_RE.test(withoutUrls);
}

export function isLinkedInUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (u.protocol === "https:" || u.protocol === "http:") && /(^|\.)linkedin\.com$/i.test(u.hostname);
  } catch {
    return false;
  }
}
