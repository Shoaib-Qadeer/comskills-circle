import { timingSafeEqual } from "node:crypto";
import { route, json } from "@/lib/api";
import { ApiError, requireAdmin } from "@/lib/auth";
import { runDaily } from "@/lib/cron";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function bearerOk(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") || "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Vercel Cron calls this once a day with "Authorization: Bearer $CRON_SECRET".
 * Admins can also call it with ?dryRun=1 to preview, which sends nothing.
 */
export const GET = route(async (req) => {
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  if (!bearerOk(req)) {
    if (!dryRun) throw new ApiError(401, "Not allowed.");
    await requireAdmin();
  }
  const report = await runDaily({ dryRun });
  console.info(`[cron] ${JSON.stringify({ ...report, digests: { ...report.digests, preview: report.digests.preview.length } })}`);
  return json(report);
});
