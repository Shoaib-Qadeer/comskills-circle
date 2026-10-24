import { requireUser } from "@/lib/auth";
import { route, json } from "@/lib/api";
import { collections } from "@/lib/db";

export const GET = route(async () => {
  const user = await requireUser();
  const { matches, opportunities, users } = await collections();
  const todayUtc = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const unseenIds = await matches
    .find({ userId: user._id, seen: false, dismissed: false }, { projection: { opportunityId: 1 } })
    .toArray();
  const unseenMatches = unseenIds.length
    ? await opportunities.countDocuments({
        _id: { $in: unseenIds.map((m) => m.opportunityId) },
        $or: [{ deadline: null }, { deadline: { $gte: todayUtc } }],
      })
    : 0;
  const pendingApprovals = user.isAdmin ? await users.countDocuments({ status: "pending" }) : 0;
  return json({ unseenMatches, pendingApprovals, total: unseenMatches + pendingApprovals });
});
