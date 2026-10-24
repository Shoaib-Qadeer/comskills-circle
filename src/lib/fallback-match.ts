import { getField } from "./taxonomy";

type ProfileLike = { fields: string[]; targetRoles: string[]; preferredLocations: string[]; freeTags?: string[] };
type OppLike = { fields: string[]; tags: string[]; title: string; summary: string; location: string | null; remote: string | null };

function words(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9à-ÿ]+/i)
    .filter((w) => w.length > 2 && !["intern", "internship", "and", "the", "for", "with"].includes(w));
}

/**
 * Rule-based matcher used when the LLM is unavailable or the daily cap is hit.
 * score = 50 × field-overlap ratio + 30 × role keyword hit + 20 × location compatible.
 */
export function fallbackScore(p: ProfileLike, o: OppLike): { score: number; reason: string } {
  const shared = p.fields.filter((f) => o.fields.includes(f));
  const denom = Math.max(1, Math.min(p.fields.length, o.fields.length));
  const fieldRatio = Math.min(1, shared.length / denom);

  const haystack = new Set(words(`${o.title} ${o.summary} ${o.tags.join(" ")}`));
  const roleWords = p.targetRoles.flatMap(words).concat((p.freeTags || []).flatMap(words));
  const roleHit = roleWords.some((w) => haystack.has(w)) ? 1 : 0;

  const locs = p.preferredLocations.map((l) => l.toLowerCase());
  const loc = (o.location || "").toLowerCase();
  const locationOk =
    o.remote === "remote" ||
    locs.length === 0 ||
    locs.some((l) => l === "anywhere" || (l === "remote" && o.remote === "remote") || (loc && (loc.includes(l) || l.includes(loc))))
      ? 1
      : 0;

  const score = Math.round(50 * fieldRatio + 30 * roleHit + 20 * locationOk);
  const reason = shared.length
    ? `Shares your interest in ${getField(shared[0]).label}.`
    : roleHit
      ? "Mentions the kind of role you're looking for."
      : "Loosely related to your profile.";
  return { score, reason };
}
