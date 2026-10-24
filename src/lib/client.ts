import { daysUntil, formatDateOnly, localDayKey } from "./time";

export class ClientError extends Error {
  constructor(public status: number, message: string, public data?: Record<string, unknown>) {
    super(message);
  }
}

export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ClientError(res.status, data?.error || `Request failed (${res.status})`, data);
  return data as T;
}

export async function api<T = unknown>(url: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ClientError(res.status, data?.error || `Request failed (${res.status})`, data);
  return data as T;
}

export function firstName(name: string): string {
  return name.split(/\s+/)[0] || name;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 30) return `${d} days ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** "12 Mar 2027" for a date-only value (YYYY-MM-DD). */
export function formatDate(iso: string | null): string {
  return formatDateOnly(iso);
}

/** Days from today (in the app time zone, Asia/Karachi by default) until a date-only value. */
export function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  return daysUntil(iso.slice(0, 10));
}

/** Today's date (app time zone) as YYYY-MM-DD, e.g. for date inputs. */
export function todayKey(): string {
  return localDayKey();
}
