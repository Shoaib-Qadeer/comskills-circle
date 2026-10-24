import { route, json } from "@/lib/api";
import { ApiError } from "@/lib/auth";
import { verifySignedValue } from "@/lib/codes";
import { toObjectId } from "@/lib/db";
import { unsubscribeAll } from "@/lib/cron";

/**
 * One-click unsubscribe (RFC 8058): mail apps POST here with the signed link from the
 * List-Unsubscribe header. The /unsubscribe page posts here too. Account emails still go out.
 */
export const POST = route(async (req) => {
  const url = new URL(req.url);
  let u = url.searchParams.get("u") || "";
  let s = url.searchParams.get("s") || "";
  if ((!u || !s) && (req.headers.get("content-type") || "").includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { u?: string; s?: string };
    u = body.u || "";
    s = body.s || "";
  }
  const id = toObjectId(u);
  if (!id || !verifySignedValue(u, s)) throw new ApiError(400, "This unsubscribe link isn't valid. You can change emails in Settings instead.");
  await unsubscribeAll(id);
  return json({ ok: true });
});
