import { route, readJson, json } from "@/lib/api";
import { signup, signupSchema } from "@/lib/accounts";
import { clientIp } from "@/lib/ratelimit";

/** Creates a pending, unverified account and emails a 6-digit code. */
export const POST = route(async (req) => {
  const body = await readJson(req, signupSchema);
  const r = await signup(body, clientIp(req.headers));
  return json({ ok: true, email: r.email }, { status: 201 });
});
