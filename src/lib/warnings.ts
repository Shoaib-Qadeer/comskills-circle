import type { Warning } from "./types";

export const EXPECTED_DURATION_MONTHS = 6;
const DAY = 24 * 60 * 60 * 1000;

type OppLike = {
  deadline: Date | string | null;
  durationMonths: number | null;
  frenchRequired: boolean | null;
  paid: boolean | null;
  type?: string;
};

/** Whole days from `now` until the end of the deadline day (deadline day itself counts as 0). */
export function daysUntil(deadline: Date | string, now: Date = new Date()): number {
  const d = new Date(deadline);
  const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((end - today) / DAY);
}

export function isExpired(deadline: Date | string | null, now: Date = new Date()): boolean {
  if (!deadline) return false;
  return daysUntil(deadline, now) < 0;
}

function fmtMonths(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

/** Deterministic warnings — computed in code, never by the LLM. */
export function computeWarnings(o: OppLike, now: Date = new Date()): Warning[] {
  const out: Warning[] = [];
  if (o.deadline) {
    const n = daysUntil(o.deadline, now);
    if (n >= 0 && n <= 3) {
      out.push({ kind: "deadline_urgent", label: n === 0 ? "⏳ Deadline today" : `⏳ Deadline in ${n} day${n === 1 ? "" : "s"}` });
    } else if (n > 3 && n <= 14) {
      out.push({ kind: "deadline_soon", label: `⏳ Deadline in ${n} days` });
    }
  } else {
    out.push({ kind: "deadline_unknown", label: "Deadline not stated" });
  }
  if (o.frenchRequired === true) out.push({ kind: "french_required", label: "🇫🇷 French required" });

  // Duration rules only make sense for internships / jobs
  const durationApplies = !o.type || o.type === "internship";
  if (durationApplies) {
    if (o.durationMonths == null) {
      out.push({ kind: "duration_unknown", label: "Duration not stated" });
    } else if (Math.abs(o.durationMonths - EXPECTED_DURATION_MONTHS) > 0.5) {
      out.push({
        kind: "duration_mismatch",
        label: `Duration: ${fmtMonths(o.durationMonths)} months (M1 needs ${EXPECTED_DURATION_MONTHS})`,
      });
    }
  }
  if (o.paid === false) out.push({ kind: "unpaid", label: "Unpaid" });
  return out;
}

/** Lower is more urgent. Used to sort matches. */
export function urgencyRank(deadline: Date | string | null, now: Date = new Date()): number {
  if (!deadline) return 10_000;
  const n = daysUntil(deadline, now);
  return n < 0 ? 20_000 : n;
}
