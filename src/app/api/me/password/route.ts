import { passwordLoginEnabled, PASSWORD_LOGIN_OFF_MESSAGE } from "@/lib/auth-config";
import { z } from "zod";
import { requireUser, ApiError } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { collections } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { passwordProblem, PASSWORD_MAX } from "@/lib/password-rules";
import { createOneTimeToken } from "@/lib/codes";
import { limitWindow } from "@/lib/ratelimit";

const schema = z.object({
  current: z.string().max(PASSWORD_MAX),
  next: z
    .string()
    .max(PASSWORD_MAX)
    .superRefine((v, ctx) => {
      const p = passwordProblem(v);
      if (p) ctx.addIssue({ code: "custom", message: p });
    }),
});

/** Changes the password and signs out every other device. Returns a token to stay signed in here. */
export const POST = route(async (req) => {
  if (!passwordLoginEnabled()) throw new ApiError(404, PASSWORD_LOGIN_OFF_MESSAGE);
  const user = await requireUser({ onboarded: false, approved: false });
  const body = await readJson(req, schema);
  await limitWindow("change-password", String(user._id), 10, "hour", "Too many tries. Wait an hour.");
  if (!(await verifyPassword(body.current, user.passwordHash))) throw new ApiError(400, "Your current password isn't right.");
  if (body.current === body.next) throw new ApiError(400, "Choose a password different from the current one.");
  const { users } = await collections();
  await users.updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(body.next), updatedAt: new Date() }, $inc: { sessionVersion: 1 } });
  return json({ ok: true, token: await createOneTimeToken(user._id) });
});
