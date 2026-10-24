import { z } from "zod";
import { requireUser, ApiError, ACTIVE_MEMBER } from "@/lib/auth";
import { route, readJson, json, type IdCtx } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { notify } from "@/lib/notify";
import { assertCanManage, loadProposal } from "@/lib/proposal-load";
import { firstName } from "@/lib/client-safe";

const schema = z.object({ userId: z.string(), note: z.string().trim().max(200).default("") });

/** The proposer invites someone (usually from "People who might fit"). */
export const POST = route(async (req, ctx: IdCtx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const p = await loadProposal(id);
  assertCanManage(p, user);
  if (p.status === "completed") throw new ApiError(409, "This project is completed.");
  const body = await readJson(req, schema);
  const uid = toObjectId(body.userId);
  if (!uid || String(uid) === String(p.proposedBy)) throw new ApiError(400, "You can't invite yourself.");
  const { users, proposalMembers, matches } = await collections();
  const invitee = await users.findOne({ _id: uid, ...ACTIVE_MEMBER }, { projection: { name: 1 } });
  if (!invitee) throw new ApiError(404, "Member not found.");
  const existing = await proposalMembers.findOne({ proposalId: p._id, userId: uid });
  if (existing && !["left"].includes(existing.status)) {
    const msg: Record<string, string> = {
      invited: "You've already invited them.",
      interested: "They're already interested. Accept them below.",
      accepted: "They're already on the team.",
      declined: "You declined them earlier.",
      removed: "You removed them from the team.",
    };
    throw new ApiError(409, msg[existing.status] ?? "They're already on the list.");
  }
  await rateLimit("invite", String(user._id), { exempt: user.isAdmin });
  const now = new Date();
  await proposalMembers.updateOne(
    { proposalId: p._id, userId: uid },
    { $set: { status: "invited", note: "", invitedBy: user._id, decidedAt: null }, $setOnInsert: { createdAt: now } },
    { upsert: true },
  );
  await matches.updateOne(
    { userId: uid, kind: "proposal", targetId: p._id },
    {
      $set: { source: "invited", taggedBy: user._id, taggedNote: body.note || null, seen: false, dismissed: false },
      $setOnInsert: { score: 0, reason: "", basic: true, saved: false, createdAt: now },
    },
    { upsert: true },
  );
  await notify([uid], {
    kind: "invite",
    text: `${user.name} invited you to join “${p.title}”.`,
    href: `/projects/${id}`,
    email: {
      subject: `${firstName(user.name)} invited you to a project`,
      heading: `You're invited to “${p.title}”`,
      lines: [`${user.name} thinks you'd be a great fit for their project.`, "Have a look, and say “I'm interested” if you'd like to join."],
      quote: body.note || null,
      cta: "See the project",
    },
  });
  return json({ ok: true });
});
