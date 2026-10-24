import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import { isPrivateIp } from "./url";

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 4;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export class FetchBlockedError extends Error {}

async function assertPublicHost(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new FetchBlockedError("Only http(s) links are allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new FetchBlockedError("That address is not public");
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new FetchBlockedError("That address is not public");
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(Math.min(total, MAX_BYTES));
  let off = 0;
  for (const c of chunks) {
    buf.set(c.subarray(0, Math.min(c.byteLength, buf.byteLength - off)), off);
    off += c.byteLength;
    if (off >= buf.byteLength) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

/** Fetches a public web page with SSRF protection, manual redirect checks, a timeout and a size cap. */
export async function safeFetchHtml(rawUrl: string): Promise<{ html: string; finalUrl: string }> {
  let url = new URL(rawUrl);
  const deadline = AbortSignal.timeout(TIMEOUT_MS);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: deadline,
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5", "accept-language": "en" },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new FetchBlockedError("Redirect without location");
      url = new URL(loc, url);
      continue;
    }
    if (!res.ok) throw new FetchBlockedError(`Page returned ${res.status}`);
    const type = res.headers.get("content-type") || "";
    if (!/html|xml|text\/plain/i.test(type)) throw new FetchBlockedError("Not a web page");
    return { html: await readCapped(res), finalUrl: url.toString() };
  }
  throw new FetchBlockedError("Too many redirects");
}

export type ParsedPage = {
  text: string;
  titleHint: string;
  siteName: string;
  description: string;
  jsonLdSummary: string;
  jobPosting: Record<string, unknown> | null;
};

function findJobPosting(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const f = findJobPosting(n);
      if (f) return f;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const t = obj["@type"];
  if (t === "JobPosting" || (Array.isArray(t) && t.includes("JobPosting"))) return obj;
  if (obj["@graph"]) return findJobPosting(obj["@graph"]);
  return null;
}

function textOf(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(textOf).filter(Boolean).join(", ");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return textOf(o.name) || [textOf(o.addressLocality), textOf(o.addressCountry)].filter(Boolean).join(", ") || textOf(o.address);
  }
  return String(v);
}

export function summarizeJobPosting(jp: Record<string, unknown> | null): string {
  if (!jp) return "";
  const parts = [
    jp.title && `title: ${textOf(jp.title)}`,
    jp.hiringOrganization && `organization: ${textOf(jp.hiringOrganization)}`,
    jp.jobLocation && `location: ${textOf(jp.jobLocation)}`,
    jp.validThrough && `validThrough: ${textOf(jp.validThrough)}`,
    jp.employmentType && `employmentType: ${textOf(jp.employmentType)}`,
    jp.jobLocationType && `jobLocationType: ${textOf(jp.jobLocationType)}`,
  ].filter(Boolean);
  return parts.join("; ").slice(0, 800);
}

export function parsePage(html: string): ParsedPage {
  const { document } = parseHTML(html);
  const meta = (sel: string) => document.querySelector(sel)?.getAttribute("content")?.trim() || "";
  const titleHint = meta('meta[property="og:title"]') || document.querySelector("title")?.textContent?.trim() || "";
  const siteName = meta('meta[property="og:site_name"]');
  const description = meta('meta[property="og:description"]') || meta('meta[name="description"]');

  let jobPosting: Record<string, unknown> | null = null;
  for (const s of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      jobPosting = findJobPosting(JSON.parse(s.textContent || ""));
      if (jobPosting) break;
    } catch {
      /* ignore malformed JSON-LD */
    }
  }

  let text = "";
  try {
    const article = new Readability(document as unknown as Document).parse();
    text = article?.textContent || "";
  } catch {
    /* fall through */
  }
  if (text.trim().length < 300) {
    // Readability can miss job boards; fall back to body text
    const { document: d2 } = parseHTML(html);
    d2.querySelectorAll("script,style,noscript,svg,nav,footer,header").forEach((el) => el.remove());
    text = d2.body?.textContent || "";
  }
  if (jobPosting?.description) {
    const { document: d3 } = parseHTML(`<div>${textOf(jobPosting.description)}</div>`);
    const jd = d3.querySelector("div")?.textContent || "";
    // JSON-LD descriptions are often the cleanest copy of the posting; include them unless already present
    if (jd.trim().length > 80 && !text.includes(jd.trim().slice(0, 60))) text = `${jd}\n\n${text}`;
  }
  text = text.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
  return { text, titleHint, siteName, description, jsonLdSummary: summarizeJobPosting(jobPosting), jobPosting };
}
