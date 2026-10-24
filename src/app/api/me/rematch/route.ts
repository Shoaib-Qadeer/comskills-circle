import { requireUser } from "@/lib/auth";
import { route, json } from "@/lib/api";
import { matchProfile } from "@/lib/matching";
import { rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

/** Called right after onboarding (with the "Finding your matches…" animation) and from Settings. */
export const POST = route(async () => {
  const user = await requireUser();
  await rateLimit("rematch", String(user._id), { exempt: user.isAdmin });
  const count = await matchProfile(user._id);
  return json({ count });
});
