import { z } from "zod";
import { requireAdmin, ApiError } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { appUrl, emailUsageToday, mailConfigured, recentEmailLog, sendEmail } from "@/lib/mail";
import { testEmail } from "@/lib/mail-templates";
import { lastCronReport } from "@/lib/cron";

/** Gmail status, today's usage, the recent log (no addresses) and the last daily run. */
export const GET = route(async () => {
  await requireAdmin();
  const [usage, log, lastCron] = await Promise.all([emailUsageToday(), recentEmailLog(60), lastCronReport()]);
  return json({
    configured: mailConfigured(),
    from: process.env.GMAIL_USER || null,
    cronSecretSet: Boolean(process.env.CRON_SECRET),
    usage,
    log,
    lastCron,
  });
});

/** Sends a test email to the admin who clicks the button. */
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  await readJson(req, z.object({ action: z.literal("test") }));
  if (!mailConfigured()) throw new ApiError(400, "Gmail isn't set up yet. Add GMAIL_USER and GMAIL_APP_PASSWORD in Vercel, then redeploy.");
  const r = await sendEmail({ to: admin.email, userId: admin._id, kind: "test", message: testEmail(appUrl("/admin?tab=email")) });
  if (!r.ok) throw new ApiError(502, r.reason === "budget" ? "Today's email limit is reached." : `Gmail refused it: ${r.error ?? "unknown error"}. "Invalid login" means the App Password is wrong.`);
  return json({ ok: true, to: admin.email });
});
