import { z } from "zod";
import { requireUser, ApiError } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { notify } from "@/lib/notify";
import { canProposerSet, teamCounts } from "@/lib/proposals";
import { assertCanManage, loadProposal } from "@/lib/proposal-load";

type Ctx = { params: Promise<{ id: string; userId: string }> };
const schema = z.object({ status: z.enum(["accepted", "declined", "removed"]) });

/** The proposer accepts, declines or removes someone. */
export const PATCH = route(async (req, ctx: Ctx) => {
  const user = await requireUser();
  const { id, userId } = await ctx.params;
  const p = await loadProposal(id);
  assertCanManage(p, user);
  const uid = toObjectId(userId);
  if (!uid) throw new ApiError(404, "Member not found.");
  const { status } = await readJson(req, schema);
  const { proposalMembers, matches } = await collections();
  const m = await proposalMembers.findOne({ proposalId: p._id, userId: uid });
  if (!m) throw new ApiError(404, "That person isn't on this project's list.");
  if (!canProposerSet(m.status, status)) throw new ApiError(409, `You can't change someone from “${m.status}” to “${status}”.`);
  await proposalMembers.updateOne({ _id: m._id }, { $set: { status, decidedAt: new Date() } });
  // Accepted people no longer need the project in "For you"
  if (status === "accepted") await matches.deleteMany({ userId: uid, kind: "proposal", targetId: p._id, saved: false });

  const href = `/projects/${id}`;
  if (status === "accepted") {
    await notify([uid], {
      kind: "memberAccepted",
      text: `You're on the team for “${p.title}”!`,
      href,
      email: { subject: `You're on the team: ${p.title}`, heading: "You're on the team!", lines: [`You were accepted to “${p.title}”.`, "Say hi to the team and connect to swap contacts."], cta: "Open the project" },
    });
  } else if (status === "declined") {
    await notify([uid], { kind: "memberDeclined", text: `The proposer of “${p.title}” went with other people this time.`, href });
  } else {
    await notify([uid], { kind: "memberRemoved", text: `You were removed from the team for “${p.title}”.`, href });
  }
  const accepted = await proposalMembers.countDocuments({ proposalId: p._id, status: "accepted" });
  return json({ ok: true, status, counts: teamCounts(p.peopleNeeded.count, accepted) });
});
