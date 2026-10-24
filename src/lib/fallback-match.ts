import { getField } from "./taxonomy";

/** The parts of a profile the rule-based matcher looks at. */
export type ProfileLike = { fields: string[]; skills: string[]; tools?: string[]; freeTags?: string[]; lookingFor?: string[] };

/** An opportunity or a project proposal, reduced to what the matcher compares. */
export type ItemLike = {
  kind: "opportunity" | "proposal";
  fields: string[];
  tags: string[];
  title: string;
  summary: string;
  /** Skills a proposal asks for. */
  skills?: string[];
  /** Opportunity type, e.g. "scholarship". */
  type?: string;
};

const STOP = new Set(["intern", "internship", "and", "the", "for", "with", "our", "you", "are", "will", "from", "this", "that", "who", "into"]);

export function words(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9+#]+/i)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/** Which opportunity types fit each "looking for" choice. */
const LOOKING_FOR_TYPES: Record<string, string[]> = {
  scholarship: ["scholarship", "fellowship", "exchange", "summer_school"],
  research: ["research", "fellowship", "summer_school"],
  job: ["job"],
  internship: ["internship"],
  collaborators: ["competition", "event"],
};

export function lookingForFits(lookingFor: string[] = [], item: Pick<ItemLike, "kind" | "type">): boolean {
  if (item.kind === "proposal") return lookingFor.includes("collaborators");
  return lookingFor.some((l) => (LOOKING_FOR_TYPES[l] || []).includes(item.type || ""));
}

/** Skills the person has that the item mentions (case-insensitive, also inside the text). */
export function skillOverlap(p: ProfileLike, item: ItemLike): string[] {
  const mine = [...p.skills, ...(p.tools || []), ...(p.freeTags || [])].map((s) => s.trim()).filter(Boolean);
  const wanted = new Set([...(item.skills || []), ...item.tags].map((s) => s.toLowerCase().trim()));
  const text = ` ${[item.title, item.summary, ...(item.skills || []), ...item.tags].join(" ").toLowerCase()} `;
  const hits: string[] = [];
  for (const s of mine) {
    const l = s.toLowerCase();
    if (wanted.has(l) || (l.length >= 2 && text.includes(` ${l} `)) || (l.length >= 4 && text.includes(l))) hits.push(s);
  }
  return Array.from(new Set(hits));
}

/**
 * Rule-based matcher used when the AI is off, out of budget, or fails.
 * score = 40 × field overlap + 35 × skills overlap + 20 × "looking for" fit + 5 if any topic word matches.
 */
export function fallbackScore(p: ProfileLike, item: ItemLike): { score: number; reason: string } {
  const shared = p.fields.filter((f) => item.fields.includes(f));
  const denom = Math.max(1, Math.min(p.fields.length, item.fields.length));
  const fieldRatio = Math.min(1, shared.length / denom);

  const skills = skillOverlap(p, item);
  const wantedCount = Math.max(1, Math.min(3, (item.skills?.length || 0) + item.tags.length || 1));
  const skillRatio = Math.min(1, skills.length / wantedCount);

  const fits = lookingForFits(p.lookingFor, item) ? 1 : 0;
  const hay = new Set(words(`${item.title} ${item.summary} ${item.tags.join(" ")}`));
  const topic = (p.freeTags || []).flatMap(words).some((w) => hay.has(w)) ? 1 : 0;

  const score = Math.round(40 * fieldRatio + 35 * skillRatio + 20 * fits + 5 * topic);
  const reason = skills.length
    ? `Your ${skills.slice(0, 2).join(" and ")} ${skills.length === 1 ? "skill fits" : "skills fit"} what this needs.`
    : shared.length
      ? `Shares your interest in ${getField(shared[0]).label}.`
      : fits
        ? item.kind === "proposal"
          ? "You said you're looking for collaborators."
          : "It's the kind of opportunity you're looking for."
        : "Loosely related to your profile.";
  return { score, reason };
}
