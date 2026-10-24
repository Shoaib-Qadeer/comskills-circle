import { requireUser } from "@/lib/auth";
import { route, json } from "@/lib/api";
import { collections } from "@/lib/db";
import { loadMiniUsers, opportunityDTO } from "@/lib/serialize";
import { loadProposalContext, proposalCardDTO } from "@/lib/proposals";
import { urgencyRank } from "@/lib/warnings";
import { trackedMap } from "@/lib/opportunities";
import type { AnyMatchDTO, MatchDoc } from "@/lib/types";

/**
 * "For you": your matches to projects and opportunities.
 * filter = all | new | saved | closed (saved opportunities whose deadline passed); kind = all | opportunity | proposal.
 */
export const GET = route(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const filter = url.searchParams.get("filter") || "all";
  const kind = url.searchParams.get("kind") || "all";
  const { matches, opportunities, proposals } = await collections();
  const q: Record<string, unknown> = { userId: user._id, dismissed: false };
  if (filter === "new") q.seen = false;
  if (filter === "saved" || filter === "closed") q.saved = true;
  if (filter === "closed" || kind === "opportunity") q.kind = "opportunity";
  else if (kind === "proposal") q.kind = "proposal";
  const ms = await matches.find(q).limit(400).toArray();

  const oppMs = ms.filter((m) => m.kind === "opportunity");
  const propMs = ms.filter((m) => m.kind === "proposal");
  const [opps, props] = await Promise.all([
    oppMs.length ? opportunities.find({ _id: { $in: oppMs.map((m) => m.targetId) } }).toArray() : [],
    propMs.length ? proposals.find({ _id: { $in: propMs.map((m) => m.targetId) } }).toArray() : [],
  ]);
  const oppById = new Map(opps.map((o) => [String(o._id), o]));
  const propById = new Map(props.map((p) => [String(p._id), p]));
  const people = await loadMiniUsers([...opps.map((o) => o.postedBy), ...ms.map((m) => m.taggedBy)]);
  const [pctx, tracked] = await Promise.all([loadProposalContext(props, user._id), trackedMap(user._id, opps.map((o) => o._id))]);

  const base = (m: MatchDoc) => {
    const tb = m.taggedBy ? people.get(String(m.taggedBy)) : null;
    return {
      id: String(m._id),
      score: m.score,
      reason: m.reason,
      basic: m.basic,
      source: m.source,
      taggedBy: tb ? { id: tb.id, name: tb.name } : null,
      taggedNote: m.taggedNote,
      seen: m.seen,
      saved: m.saved,
      createdAt: m.createdAt.toISOString(),
    };
  };

  const items: AnyMatchDTO[] = [];
  for (const m of oppMs) {
    const o = oppById.get(String(m.targetId));
    if (!o) continue;
    const dto = { ...opportunityDTO(o, user, people), trackedId: tracked.get(String(o._id)) ?? null };
    // Current views show open opportunities only; closed ones live in the Archive
    if (filter === "closed" ? dto.status !== "expired" : dto.status === "expired") continue;
    items.push({ ...base(m), kind: "opportunity", coach: m.coach ?? null, opportunity: dto });
  }
  if (filter !== "closed") {
    for (const m of propMs) {
      const p = propById.get(String(m.targetId));
      if (!p) continue;
      const card = proposalCardDTO(p, user._id, {
        people: pctx.people,
        acceptedIds: pctx.acceptedBy.get(String(p._id)) ?? [],
        myStatus: pctx.myStatus.get(String(p._id)) ?? null,
        match: { score: m.score, reason: m.reason, basic: m.basic },
      });
      const invited = card.myStatus === "invited";
      // Hide projects that can't take you any more (unless you were invited or saved it)
      if (card.myStatus === "accepted" || card.myStatus === "declined" || card.myStatus === "removed") continue;
      if (!invited && !m.saved && (p.status === "completed" || !p.acceptingMembers)) continue;
      items.push({ ...base(m), kind: "proposal", proposal: card });
    }
  }
  const pinned = (x: AnyMatchDTO) => Number(x.source === "tagged" || x.source === "invited");
  const urgency = (x: AnyMatchDTO) => (x.kind === "opportunity" ? urgencyRank(x.opportunity.deadline) : 5_000);
  items.sort((a, b) => pinned(b) - pinned(a) || b.score - a.score || urgency(a) - urgency(b));
  return json({ items });
});
