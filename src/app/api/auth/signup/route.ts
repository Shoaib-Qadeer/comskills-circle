import { passwordLoginEnabled, PASSWORD_LOGIN_OFF_MESSAGE } from "@/lib/auth-config";
import { ApiError } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { signup, signupSchema } from "@/lib/accounts";
import { clientIp } from "@/lib/ratelimit";

/** Creates a pending, unverified account and emails a 6-digit code. */
export const POST = route(async (req) => {
  if (!passwordLoginEnabled()) throw new ApiError(404, PASSWORD_LOGIN_OFF_MESSAGE);
  const body = await readJson(req, signupSchema);
  const r = await signup(body, clientIp(req.headers));
  return json({ ok: true, email: r.email }, { status: 201 });
});
