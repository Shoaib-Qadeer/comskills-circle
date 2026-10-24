import { requireUser, ApiError, ACTIVE_MEMBER, isTeam } from "@/lib/auth";
import { route, json, type IdCtx } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { memberProfileDTO } from "@/lib/serialize";
import { connectStateBetween } from "@/lib/connect";
import { getSettings } from "@/lib/settings";
import { scholarshipDTO, visibleEntries } from "@/lib/scholarships";
import { loadProposalContext, proposalCardDTO } from "@/lib/proposals";

/**
 * One member's full profile. Contacts are added only when the privacy rule allows it, and
 * scholarship entries are filtered the same way (team-only rejections stay hidden).
 */
export const GET = route(async (_req, ctx: IdCtx) => {
  const viewer = await requireUser();
  const { id } = await ctx.params;
  const oid = toObjectId(id);
  if (!oid) throw new ApiError(404, "Member not found.");
  const c = await collections();
  const u = await c.users.findOne({ _id: oid, ...ACTIVE_MEMBER });
  if (!u) throw new ApiError(404, "Member not found.");
  const [connect, settings, entries, memberships] = await Promise.all([
    connectStateBetween(viewer._id, u._id),
    getSettings(),
    c.scholarships.find({ userId: u._id }).sort({ updatedAt: -1 }).limit(100).toArray(),
    c.proposalMembers.find({ userId: u._id, status: "accepted" }, { projection: { proposalId: 1 } }).toArray(),
  ]);
  const props = await c.proposals
    .find({ $or: [{ proposedBy: u._id }, { _id: { $in: memberships.map((m) => m.proposalId) } }] })
    .sort({ createdAt: -1 })
    .limit(30)
    .toArray();
  const pctx = await loadProposalContext(props, viewer._id);
  const visible = visibleEntries(entries, { _id: viewer._id, isAdmin: viewer.isAdmin, isTeam: isTeam(viewer) });
  return json({
    ...memberProfileDTO(u, viewer, { connect, settings }),
    projects: props.map((p) => ({
      ...proposalCardDTO(p, viewer._id, {
        people: pctx.people,
        acceptedIds: pctx.acceptedBy.get(String(p._id)) ?? [],
        myStatus: pctx.myStatus.get(String(p._id)) ?? null,
        match: pctx.matchBy.get(String(p._id)) ?? null,
      }),
      role: String(p.proposedBy) === String(u._id) ? "proposer" : "member",
    })),
    scholarships: visible.map((s) => scholarshipDTO(s, viewer._id)),
  });
});
