import { collections } from "./db";
import { ApiError } from "./auth";
import { getSettings, type AppSettings } from "./settings";
import { localDayKey } from "./time";

export type Window = "day" | "hour" | "15min";

/** Per-person daily actions whose limits admins can edit (Admin → AI → per-person limits). */
export type DailyAction =
  | "extract"
  | "post"
  | "proposal"
  | "interest"
  | "connect"
  | "announce"
  | "coach"
  | "tracker"
  | "report"
  | "suggest"
  | "rematch"
  | "invite";

export function dailyLimitFor(action: DailyAction, limits: AppSettings["limits"]): number {
  switch (action) {
    case "extract":
      return limits.extractPerDay;
    case "post":
      return limits.postPerDay;
    case "proposal":
      return limits.proposalsPerDay;
    case "interest":
      return limits.interestPerDay;
    case "connect":
      return limits.connectPerDay;
    case "announce":
      return limits.announcePerDay;
    case "coach":
      return limits.coachPerDay;
    case "tracker":
      return limits.trackerPerDay;
    case "report":
      return limits.reportsPerDay;
    case "suggest":
      return 60;
    case "rematch":
      return 20;
    case "invite":
      return 40;
  }
}

/** The bucket a timestamp falls into, e.g. "2026-10-24" (day, app time zone), "2026-10-24T09" (hour). */
export function bucketFor(window: Window, now: Date = new Date()): string {
  if (window === "day") return localDayKey(now);
  const iso = now.toISOString();
  if (window === "hour") return iso.slice(0, 13);
  const q = Math.floor(now.getUTCMinutes() / 15);
  return `${iso.slice(0, 13)}:${q}`;
}

const WINDOW_MS: Record<Window, number> = { day: 2 * 86_400_000, hour: 2 * 3_600_000, "15min": 30 * 60_000 };

/** Adds one hit to a counter and returns the new count. A TTL index removes old counters. */
export async function hit(action: string, key: string, window: Window): Promise<number> {
  const { rates } = await collections();
  const doc = await rates.findOneAndUpdate(
    { _id: `${action}:${key}:${bucketFor(window)}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + WINDOW_MS[window]) } },
    { upsert: true, returnDocument: "after" },
  );
  return doc?.count ?? 1;
}

/** Current count without adding a hit. */
export async function peek(action: string, key: string, window: Window): Promise<number> {
  const { rates } = await collections();
  const doc = await rates.findOne({ _id: `${action}:${key}:${bucketFor(window)}` });
  return doc?.count ?? 0;
}

/** Per-person, per-day limit. Throws 429 when exceeded. Admins are exempt. */
export async function rateLimit(action: DailyAction, userId: string, opts: { exempt?: boolean } = {}) {
  if (opts.exempt) return;
  const { limits } = await getSettings();
  const max = dailyLimitFor(action, limits);
  const n = await hit(action, userId, "day");
  if (n > max) throw new ApiError(429, `You've reached today's limit (${max}). Try again tomorrow.`);
}

/** A fixed limit in any window, e.g. 5 codes per email per hour. Throws 429 with `message`. */
export async function limitWindow(action: string, key: string, max: number, window: Window, message: string) {
  const n = await hit(action, key, window);
  if (n > max) throw new ApiError(429, message);
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(headers: Headers | Record<string, string | string[] | undefined> | undefined): string {
  const get = (k: string): string | undefined => {
    if (!headers) return undefined;
    if (headers instanceof Headers) return headers.get(k) ?? undefined;
    const v = headers[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const xff = get("x-forwarded-for");
  const ip = (xff ? xff.split(",")[0] : get("x-real-ip")) || "unknown";
  return ip.trim().slice(0, 64);
}
