import { requireUser, ACTIVE_MEMBER } from "@/lib/auth";
import { route, json, type IdCtx } from "@/lib/api";
import { collections } from "@/lib/db";
import { memberCardDTO } from "@/lib/serialize";
import { getSettings } from "@/lib/settings";
import { assertCanManage, loadProposal } from "@/lib/proposal-load";
import type { SuggestedPersonDTO } from "@/lib/types";

/** "People who might fit": the proposer's view of the best matches, with Invite. */
export const GET = route(async (_req, ctx: IdCtx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const p = await loadProposal(id);
  assertCanManage(p, user);
  const { matches, users, proposalMembers } = await collections();
  const [ms, members, settings] = await Promise.all([
    matches.find({ kind: "proposal", targetId: p._id }).sort({ score: -1 }).limit(40).toArray(),
    proposalMembers.find({ proposalId: p._id }).toArray(),
    getSettings(),
  ]);
  const statusOf = new Map(members.map((m) => [String(m.userId), m.status]));
  const candidates = ms.filter((m) => {
    const s = statusOf.get(String(m.userId));
    return !s || s === "invited" || s === "left";
  });
  const people = await users.find({ _id: { $in: candidates.map((m) => m.userId) }, ...ACTIVE_MEMBER }).toArray();
  const byId = new Map(people.map((u) => [String(u._id), u]));
  const items: SuggestedPersonDTO[] = candidates
    .filter((m) => byId.has(String(m.userId)))
    .slice(0, 12)
    .map((m) => ({
      member: memberCardDTO(byId.get(String(m.userId))!, user._id, settings),
      score: m.score,
      reason: m.reason,
      basic: m.basic,
      invited: statusOf.get(String(m.userId)) === "invited",
    }));
  return json({ items, matchCount: p.matchCount, matchedAt: p.updatedAt.toISOString() });
});
