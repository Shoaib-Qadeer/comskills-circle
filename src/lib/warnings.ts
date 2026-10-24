import type { Warning } from "./types";
import { daysUntil as localDaysUntil, appTimeZone } from "./time";
import { FUNDED_TYPES, PAID_TYPES } from "./taxonomy";

type OppLike = {
  deadline: Date | string | null;
  paid: boolean | null;
  funding?: string | null;
  type?: string;
};

/**
 * Whole days from today (in the app's time zone, Asia/Karachi by default) until the deadline day.
 * The deadline day itself counts as 0; yesterday is -1.
 */
export function daysUntil(deadline: Date | string, now: Date = new Date(), tz: string = appTimeZone()): number {
  return localDaysUntil(deadline, now, tz);
}

export function isExpired(deadline: Date | string | null, now: Date = new Date(), tz: string = appTimeZone()): boolean {
  if (!deadline) return false;
  return daysUntil(deadline, now, tz) < 0;
}

/** Deterministic warnings, computed in code, never by the LLM. */
export function computeWarnings(o: OppLike, now: Date = new Date(), tz: string = appTimeZone()): Warning[] {
  const out: Warning[] = [];
  if (o.deadline) {
    const n = daysUntil(o.deadline, now, tz);
    if (n >= 0 && n <= 3) {
      out.push({ kind: "deadline_urgent", label: n === 0 ? "⏳ Deadline today" : `⏳ Deadline in ${n} day${n === 1 ? "" : "s"}` });
    } else if (n > 3 && n <= 14) {
      out.push({ kind: "deadline_soon", label: `⏳ Deadline in ${n} days` });
    }
  } else {
    out.push({ kind: "deadline_unknown", label: "Deadline not stated" });
  }
  if (o.type && FUNDED_TYPES.includes(o.type) && !o.funding) out.push({ kind: "funding_unknown", label: "Funding not stated" });
  if (o.paid === false && (!o.type || PAID_TYPES.includes(o.type))) out.push({ kind: "unpaid", label: "Unpaid" });
  return out;
}

/** Lower is more urgent. Used to sort matches. */
export function urgencyRank(deadline: Date | string | null, now: Date = new Date()): number {
  if (!deadline) return 10_000;
  const n = daysUntil(deadline, now);
  return n < 0 ? 20_000 : n;
}
