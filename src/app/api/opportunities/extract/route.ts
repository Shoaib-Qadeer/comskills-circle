import { requireUser } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { extractRequestSchema } from "@/lib/schemas";
import { extractOpportunity } from "@/lib/extract";
import { rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson(req, extractRequestSchema);
  await rateLimit("extract", String(user._id), { exempt: user.isAdmin });
  const result = await extractOpportunity(body);
  return json(result);
});
