import { route, readJson, json } from "@/lib/api";
import { forgotPassword, forgotSchema, FORGOT_REPLY } from "@/lib/accounts";
import { clientIp } from "@/lib/ratelimit";

export const POST = route(async (req) => {
  const body = await readJson(req, forgotSchema);
  await forgotPassword(body.email, clientIp(req.headers));
  return json({ ok: true, message: FORGOT_REPLY });
});
