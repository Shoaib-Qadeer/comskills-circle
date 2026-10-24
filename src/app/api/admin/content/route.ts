import { requireAdmin } from "@/lib/auth";
import { route, json } from "@/lib/api";
import { collections } from "@/lib/db";
import { loadMiniUsers, opportunityDTO } from "@/lib/serialize";

/** Every opportunity (open and archived), for moderation. */
export const GET = route(async () => {
  const admin = await requireAdmin();
  const { opportunities } = await collections();
  const opps = await opportunities.find({}).sort({ createdAt: -1 }).limit(1000).toArray();
  const people = await loadMiniUsers(opps.map((o) => o.postedBy));
  return json({ opportunities: opps.map((o) => opportunityDTO(o, admin, people)) });
});
