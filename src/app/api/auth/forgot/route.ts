import { passwordLoginEnabled, PASSWORD_LOGIN_OFF_MESSAGE } from "@/lib/auth-config";
import { ApiError } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { forgotPassword, forgotSchema, FORGOT_REPLY } from "@/lib/accounts";
import { clientIp } from "@/lib/ratelimit";

export const POST = route(async (req) => {
  if (!passwordLoginEnabled()) throw new ApiError(404, PASSWORD_LOGIN_OFF_MESSAGE);
  const body = await readJson(req, forgotSchema);
  await forgotPassword(body.email, clientIp(req.headers));
  return json({ ok: true, message: FORGOT_REPLY });
});
