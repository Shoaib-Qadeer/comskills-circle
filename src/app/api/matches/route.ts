import { requireUser } from "@/lib/auth";
import { route, json } from "@/lib/api";
import { collections } from "@/lib/db";
import { loadMiniUsers, opportunityDTO } from "@/lib/serialize";
import { urgencyRank } from "@/lib/warnings";
import type { MatchDTO } from "@/lib/types";

export const GET = route(async (req) => {
  const user = await requireUser();
  // "closed" = saved matches whose deadline has passed (shown in the Archive)
  const filter = new URL(req.url).searchParams.get("filter") || "all";
  const { matches, opportunities } = await collections();
  const q: Record<string, unknown> = { userId: user._id, dismissed: false };
  if (filter === "new") q.seen = false;
  if (filter === "saved" || filter === "closed") q.saved = true;
  const ms = await matches.find(q).limit(300).toArray();
  const opps = await opportunities.find({ _id: { $in: ms.map((m) => m.opportunityId) } }).toArray();
  const oppById = new Map(opps.map((o) => [String(o._id), o]));
  const people = await loadMiniUsers([...opps.map((o) => o.postedBy), ...ms.map((m) => m.taggedBy)]);

  const items: MatchDTO[] = [];
  for (const m of ms) {
    const o = oppById.get(String(m.opportunityId));
    if (!o) continue;
    const dto = opportunityDTO(o, user, people);
    // Current views show open opportunities only; closed ones live in the Archive
    if (filter === "closed" ? dto.status !== "expired" : dto.status === "expired") continue;
    const tb = m.taggedBy ? people.get(String(m.taggedBy)) : null;
    items.push({
      id: String(m._id),
      score: m.score,
      reason: m.reason,
      basic: m.basic,
      source: m.source,
      taggedBy: tb ? { id: tb.id, name: tb.name } : null,
      taggedNote: m.taggedNote,
      seen: m.seen,
      saved: m.saved,
      coach: m.coach ?? null,
      opportunity: dto,
    });
  }
  // tagged → urgency → score
  items.sort(
    (a, b) =>
      Number(b.source === "tagged") - Number(a.source === "tagged") ||
      urgencyRank(a.opportunity.deadline) - urgencyRank(b.opportunity.deadline) ||
      b.score - a.score,
  );
  return json({ items });
});
