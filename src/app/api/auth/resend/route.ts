import { route, readJson, json } from "@/lib/api";
import { resendCode, resendSchema } from "@/lib/accounts";
import { clientIp } from "@/lib/ratelimit";

/** Sends a new code. Always replies the same way, so it can't be used to discover accounts. */
export const POST = route(async (req) => {
  const body = await readJson(req, resendSchema);
  await resendCode(body.email, body.purpose, clientIp(req.headers));
  return json({ ok: true, message: "If that email needs a code, we've sent a new one." });
});
