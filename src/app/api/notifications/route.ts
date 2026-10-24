import { requireUser } from "@/lib/auth";
import { route, json } from "@/lib/api";
import { collections } from "@/lib/db";
import { notificationDTO } from "@/lib/serialize";
import { localDayKey } from "@/lib/time";

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
  const todayUtc = new Date(`${localDayKey()}T00:00:00Z`);
  const [unread, pendingConnect, unseen, pendingApprovals] = await Promise.all([
    c.notifications.countDocuments({ userId: user._id, read: false }),
    c.connectRequests.countDocuments({ to: user._id, status: "pending" }),
    c.matches.find({ userId: user._id, seen: false, dismissed: false }, { projection: { kind: 1, targetId: 1 } }).toArray(),
    user.isAdmin ? c.users.countDocuments({ status: "pending", emailVerifiedAt: { $ne: null } }) : Promise.resolve(0),
  ]);
  const oppIds = unseen.filter((m) => m.kind === "opportunity").map((m) => m.targetId);
  const propIds = unseen.filter((m) => m.kind === "proposal").map((m) => m.targetId);
  const [openOpps, openProps] = await Promise.all([
    oppIds.length ? c.opportunities.countDocuments({ _id: { $in: oppIds }, $or: [{ deadline: null }, { deadline: { $gte: todayUtc } }] }) : 0,
    propIds.length ? c.proposals.countDocuments({ _id: { $in: propIds }, status: { $ne: "completed" } }) : 0,
  ]);
  const unseenMatches = openOpps + openProps;
  const seenAt = user.seen?.announcementsAt ?? null;
  const unreadNews = await c.announcements.countDocuments({ ...(seenAt ? { createdAt: { $gt: seenAt } } : {}), authorId: { $ne: user._id } });
  return json({ unread, pendingConnect, unseenMatches, unseenProjectMatches: openProps, unreadNews, pendingApprovals, total: unread + pendingApprovals });
});
