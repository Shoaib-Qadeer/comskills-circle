import { requireAdmin } from "@/lib/auth";
import { route, json } from "@/lib/api";
import { collections } from "@/lib/db";
import { connectionDTO, loadMiniUsers, opportunityDTO } from "@/lib/serialize";

/** Every opportunity (open and archived) and every connection, for moderation. */
export const GET = route(async () => {
  const admin = await requireAdmin();
  const { opportunities, connections } = await collections();
  const [opps, conns] = await Promise.all([
    opportunities.find({}).sort({ createdAt: -1 }).limit(1000).toArray(),
    connections.find({}).sort({ createdAt: -1 }).limit(1000).toArray(),
  ]);
  const people = await loadMiniUsers([...opps.map((o) => o.postedBy), ...conns.map((c) => c.addedBy)]);
  return json({
    opportunities: opps.map((o) => opportunityDTO(o, admin, people)),
    connections: conns.map((c) => connectionDTO(c, admin._id, people)),
  });
});
