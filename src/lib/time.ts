// Time-zone helpers. Everything is stored in UTC; "today", deadlines and digest timing use the
// app time zone (APP_TIME_ZONE, default Asia/Karachi). Safe to import on client and server.

export const DEFAULT_TZ = "Asia/Karachi";

/** The configured time zone. On the client it is read from <html data-tz>, set by the root layout. */
export function appTimeZone(): string {
  if (typeof document !== "undefined") return document.documentElement.dataset.tz || DEFAULT_TZ;
  return process.env.APP_TIME_ZONE || DEFAULT_TZ;
}

const DAY = 86_400_000;

/** "YYYY-MM-DD" for the given instant in the given time zone. */
export function localDayKey(d: Date = new Date(), tz: string = appTimeZone()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Date-only values (deadlines, start dates) are stored as UTC midnight; this returns their YYYY-MM-DD. */
export function dateOnlyKey(d: Date | string): string {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return new Date(d).toISOString().slice(0, 10);
}

/** Stores a YYYY-MM-DD as UTC midnight. */
export function dateFromKey(key: string): Date {
  return new Date(`${key.slice(0, 10)}T00:00:00Z`);
}

function keyToUtcMs(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from today (in the app time zone) until a date-only value. Today = 0, yesterday = -1. */
export function daysUntil(date: Date | string, now: Date = new Date(), tz: string = appTimeZone()): number {
  return Math.round((keyToUtcMs(dateOnlyKey(date)) - keyToUtcMs(localDayKey(now, tz))) / DAY);
}

/** Day of week (0 = Sunday … 6 = Saturday) of `now` in the app time zone. */
export function localWeekday(now: Date = new Date(), tz: string = appTimeZone()): number {
  return new Date(keyToUtcMs(localDayKey(now, tz))).getUTCDay();
}

/** Day of month (1–31) in the app time zone. */
export function localDayOfMonth(now: Date = new Date(), tz: string = appTimeZone()): number {
  return Number(localDayKey(now, tz).slice(8, 10));
}

/** Offset of the time zone from UTC at a given instant, in ms (Asia/Karachi → +5 h). */
export function tzOffsetMs(at: Date, tz: string = appTimeZone()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The UTC instant at which today's local day started, e.g. 19:00 UTC the day before for Asia/Karachi. */
export function startOfLocalDay(now: Date = new Date(), tz: string = appTimeZone()): Date {
  const midnightUtc = keyToUtcMs(localDayKey(now, tz));
  return new Date(midnightUtc - tzOffsetMs(new Date(midnightUtc), tz));
}

/** "12 Mar 2027" in the app time zone, for instants. */
export function formatInstant(d: Date | string, tz: string = appTimeZone()): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: tz });
}

/** "12 Mar 2027" for date-only values (no time-zone shift). */
export function formatDateOnly(d: Date | string | null | undefined): string {
  if (!d) return "";
  return dateFromKey(dateOnlyKey(d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
