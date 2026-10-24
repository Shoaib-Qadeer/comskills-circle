import { passwordLoginEnabled, PASSWORD_LOGIN_OFF_MESSAGE } from "@/lib/auth-config";
import { ApiError } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { resetPassword, resetSchema } from "@/lib/accounts";
import { limitWindow, clientIp } from "@/lib/ratelimit";

/** New password from an emailed code. Signs out all other devices. */
export const POST = route(async (req) => {
  if (!passwordLoginEnabled()) throw new ApiError(404, PASSWORD_LOGIN_OFF_MESSAGE);
  const body = await readJson(req, resetSchema);
  await limitWindow("verify-ip", clientIp(req.headers), 60, "15min", "Too many tries from this network. Wait 15 minutes.");
  const r = await resetPassword(body.email, body.code, body.password);
  return json({ ok: true, token: r.token });
});
