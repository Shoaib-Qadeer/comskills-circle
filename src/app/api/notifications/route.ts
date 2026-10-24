import { requireUser } from "@/lib/auth";
import { route, json } from "@/lib/api";
import { collections } from "@/lib/db";
import { notificationDTO } from "@/lib/serialize";

/**
 * Badge counts (default) or the inbox list (?list=1). Counts are cheap so the shell can poll
 * them every minute without hurting slow connections.
 */
export const GET = route(async (req) => {
  const user = await requireUser();
  const c = await collections();
  if (new URL(req.url).searchParams.get("list") === "1") {
    const docs = await c.notifications.find({ userId: user._id }).sort({ createdAt: -1 }).limit(100).toArray();
    return json({ items: docs.map(notificationDTO) });
  }
  const todayUtc = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const [unread, pendingConnect, unseenIds, pendingApprovals] = await Promise.all([
    c.notifications.countDocuments({ userId: user._id, read: false }),
    c.connectRequests.countDocuments({ to: user._id, status: "pending" }),
    c.matches.find({ userId: user._id, seen: false, dismissed: false }, { projection: { opportunityId: 1 } }).toArray(),
    user.isAdmin ? c.users.countDocuments({ status: "pending", emailVerifiedAt: { $ne: null } }) : Promise.resolve(0),
  ]);
  const unseenMatches = unseenIds.length
    ? await c.opportunities.countDocuments({ _id: { $in: unseenIds.map((m) => m.opportunityId) }, $or: [{ deadline: null }, { deadline: { $gte: todayUtc } }] })
    : 0;
  return json({ unread, pendingConnect, unseenMatches, pendingApprovals, total: unread + pendingApprovals });
});
