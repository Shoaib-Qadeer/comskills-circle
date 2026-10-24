// WhatsApp numbers are stored in E.164 (+923001234567). Client-safe.

/**
 * Turns what people type into E.164, assuming Pakistan (+92) for local numbers:
 * "0300 1234567" → "+923001234567", "0092 300 1234567" → "+923001234567",
 * "+44 7700 900123" stays international. Returns null if it can't be a phone number.
 */
export function normalizeWhatsapp(input: string, defaultCountryCode = "92"): string | null {
  const t = input.trim();
  if (!t) return null;
  let digits = t.replace(/[\s().-]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith("+")) {
    if (/^0\d{9,11}$/.test(digits)) digits = `+${defaultCountryCode}${digits.slice(1)}`;
    else if (digits.startsWith(defaultCountryCode) && digits.length >= 11) digits = `+${digits}`;
    else return null;
  }
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

/** https://wa.me/923001234567 (digits only, no plus). */
export function waMeLink(e164: string, text?: string): string {
  const base = `https://wa.me/${e164.replace(/\D/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** A WhatsApp share link with prefilled text (no number: the person picks a chat). */
export function waShareLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** "+92 300 1234567" for display. */
export function prettyPhone(e164: string): string {
  const m = e164.match(/^\+92(\d{3})(\d{7})$/);
  if (m) return `+92 ${m[1]} ${m[2]}`;
  return e164;
}
