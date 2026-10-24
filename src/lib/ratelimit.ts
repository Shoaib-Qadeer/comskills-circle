import { collections } from "./db";
import { ApiError } from "./auth";
import { getSettings } from "./settings";

type Action = "extract" | "post" | "intro" | "coach" | "suggest" | "rematch";

async function limitFor(action: Action): Promise<number> {
  const { limits } = await getSettings();
  switch (action) {
    case "extract":
      return limits.extractPerDay;
    case "post":
      return limits.postPerDay;
    case "intro":
      return limits.introPerDay;
    case "coach":
      return limits.coachPerDay;
    case "suggest":
      return 60;
    case "rematch":
      return 20;
  }
}

/** Per-person, per-day counter stored in Mongo (a TTL index cleans up). Throws 429 when exceeded. Admins are exempt. */
export async function rateLimit(action: Action, userId: string, opts: { exempt?: boolean } = {}) {
  if (opts.exempt) return;
  const max = await limitFor(action);
  const day = new Date().toISOString().slice(0, 10);
  const { rates } = await collections();
  const doc = await rates.findOneAndUpdate(
    { _id: `${action}:${userId}:${day}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + 2 * 24 * 3600 * 1000) } },
    { upsert: true, returnDocument: "after" },
  );
  if ((doc?.count ?? 1) > max) {
    throw new ApiError(429, `Daily limit reached (${max} per day). Try again tomorrow.`);
  }
}
