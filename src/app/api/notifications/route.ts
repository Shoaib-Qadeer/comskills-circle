import { requireUser } from "@/lib/auth";
import { route, json } from "@/lib/api";
import { collections } from "@/lib/db";

export const GET = route(async () => {
  const user = await requireUser();
  const { matches, introRequests, opportunities } = await collections();
  const todayUtc = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const unseenIds = await matches
    .find({ userId: user._id, seen: false, dismissed: false }, { projection: { opportunityId: 1 } })
    .toArray();
  // Don't count matches whose opportunity has already expired
  const unseenMatches = unseenIds.length
    ? await opportunities.countDocuments({
        _id: { $in: unseenIds.map((m) => m.opportunityId) },
        $or: [{ deadline: null }, { deadline: { $gte: todayUtc } }],
      })
    : 0;
  const incomingIntros = await introRequests.countDocuments({ addedBy: user._id, status: "pending" });
  const pendingApprovals = user.isAdmin ? await (await collections()).users.countDocuments({ status: "pending" }) : 0;
  return json({ unseenMatches, incomingIntros, pendingApprovals, total: unseenMatches + incomingIntros + pendingApprovals });
});
