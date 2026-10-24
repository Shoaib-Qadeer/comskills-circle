// Pure URL helpers (no Node-only imports) so they can be used on client and server.

const TRACKING_PARAMS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^mc_(cid|eid)$/i,
  /^ref$/i,
  /^ref_src$/i,
  /^trk$/i,
  /^trackingId$/i,
  /^refId$/i,
  /^_hs(enc|mi)$/i,
  /^igshid$/i,
  /^si$/i,
];

/** Normalizes a URL for duplicate detection: lowercase host, no tracking params, no fragment, no trailing slash. */
export function normalizeUrl(input: string): string | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  u.hash = "";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  if ((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) u.port = "";
  const keep = new URLSearchParams();
  const entries = Array.from(u.searchParams.entries())
    .filter(([k]) => !TRACKING_PARAMS.some((re) => re.test(k)))
    .sort(([a], [b]) => a.localeCompare(b));
  for (const [k, v] of entries) keep.append(k, v);
  u.search = keep.toString();
  u.pathname = u.pathname.replace(/\/+$/, "") || "/";
  let s = u.toString();
  // Treat http and https as the same resource for duplicate checks
  s = s.replace(/^http:\/\//, "https://");
  if (s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

/** True only for absolute http(s) URLs — use before rendering any user-supplied link. */
export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Returns true if an IPv4/IPv6 literal is private, loopback, link-local, metadata or otherwise non-public. */
export function isPrivateIp(ip: string): boolean {
  const v = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");
  // IPv4-mapped IPv6
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIp(mapped[1]);
  const m4 = v.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m4) {
    const [a, b] = [Number(m4[1]), Number(m4[2])];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (v.includes(":")) {
    if (v === "::" || v === "::1") return true;
    if (v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")) return true; // link-local
    if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique local
    if (v.startsWith("ff")) return true; // multicast
    return false;
  }
  return true; // not an IP we understand → treat as unsafe
}

export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
