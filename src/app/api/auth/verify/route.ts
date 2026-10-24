import { route, readJson, json } from "@/lib/api";
import { verifyEmail, verifySchema } from "@/lib/accounts";
import { limitWindow, clientIp } from "@/lib/ratelimit";

/** Checks the code. Returns a short-lived one-time token the browser exchanges for a session. */
export const POST = route(async (req) => {
  const body = await readJson(req, verifySchema);
  await limitWindow("verify-ip", clientIp(req.headers), 60, "15min", "Too many tries from this network. Wait 15 minutes.");
  const r = await verifyEmail(body.email, body.code);
  return json({ ok: true, token: r.token, status: r.status, onboarded: r.onboarded });
});
