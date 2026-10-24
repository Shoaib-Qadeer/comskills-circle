import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { route, readJson, json, type IdCtx } from "@/lib/api";
import { collections } from "@/lib/db";
import { onlyValidFields } from "@/lib/taxonomy";
import { matchProposal } from "@/lib/matching";
import { notify } from "@/lib/notify";
import { applyStatus, proposalDetailDTO, proposalPatchSchema } from "@/lib/proposals";
import { assertCanManage, loadProposal } from "@/lib/proposal-load";
import { PROPOSAL_STATUS_LABEL, type UserDoc } from "@/lib/types";

export const maxDuration = 60;

async function detail(id: string, viewer: UserDoc) {
  const p = await loadProposal(id);
  const c = await collections();
  const [members, match] = await Promise.all([
    c.proposalMembers.find({ proposalId: p._id }).toArray(),
    c.matches.findOne({ userId: viewer._id, kind: "proposal", targetId: p._id, dismissed: false }),
  ]);
  const ids = [...members.map((m) => m.userId), ...(p.proposedBy ? [p.proposedBy] : [])];
  const people = await c.users
    .find({ _id: { $in: ids } }, { projection: { name: 1, hasPhoto: 1, photoVersion: 1, fieldOfStudy: 1, skills: 1, status: 1, onboarded: 1 } })
    .toArray();
  return proposalDetailDTO(p, viewer, {
    people: new Map(people.map((u) => [String(u._id), u])),
    members,
    match: match ? { score: match.score, reason: match.reason, basic: match.basic } : null,
  });
}

export const GET = route(async (_req, ctx: IdCtx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return json(await detail(id, user));
});

const MATCH_FIELDS = ["title", "problem", "idea", "peopleNeeded", "fields", "tags"] as const;

/** Edit the pitch, change status, or open/close to new members (proposer or admin). */
export const PATCH = route(async (req, ctx: IdCtx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const p = await loadProposal(id);
  assertCanManage(p, user);
  const patch = await readJson(req, proposalPatchSchema);
  const now = new Date();
  const set: Record<string, unknown> = { ...patch, updatedAt: now };
  if (patch.fields) set.fields = onlyValidFields(patch.fields).slice(0, 4);
  const statusChanged = patch.status && patch.status !== p.status;
  if (patch.status) {
    const next = applyStatus(patch.status, patch.acceptingMembers ?? p.acceptingMembers);
    Object.assign(set, next);
    if (statusChanged) set.statusChangedAt = now;
  }
  const { proposals, proposalMembers } = await collections();
  await proposals.updateOne({ _id: p._id }, { $set: set });

  if (statusChanged) {
    const team = await proposalMembers.find({ proposalId: p._id, status: "accepted" }, { projection: { userId: 1 } }).toArray();
    const label = PROPOSAL_STATUS_LABEL[patch.status!];
    await notify(
      team.map((t) => t.userId),
      {
        kind: "projectStatus",
        text: `“${p.title}” is now ${label.toLowerCase()}.`,
        href: `/projects/${id}`,
        email: { subject: `${p.title}: now ${label.toLowerCase()}`, heading: `Your project is now ${label.toLowerCase()}`, lines: [`“${p.title}” moved to ${label}.`], cta: "Open the project" },
      },
    );
  }
  if (MATCH_FIELDS.some((k) => k in patch) || (patch.acceptingMembers === true && !p.acceptingMembers)) {
    after(async () => {
      try {
        await matchProposal(p._id);
      } catch (e) {
        console.error("[rematch proposal]", e);
      }
    });
  }
  return json(await detail(id, user));
});

/** Deletes the proposal with its members, matches and reports (proposer or admin). */
export const DELETE = route(async (_req, ctx: IdCtx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const p = await loadProposal(id);
  assertCanManage(p, user);
  const { proposals, proposalMembers, matches, reports } = await collections();
  const team = await proposalMembers.find({ proposalId: p._id, status: { $in: ["accepted", "interested", "invited"] } }, { projection: { userId: 1 } }).toArray();
  await Promise.all([
    proposals.deleteOne({ _id: p._id }),
    proposalMembers.deleteMany({ proposalId: p._id }),
    matches.deleteMany({ kind: "proposal", targetId: p._id }),
    reports.deleteMany({ kind: "proposal", targetId: p._id }),
  ]);
  await notify(
    team.map((t) => t.userId).filter((u) => String(u) !== String(user._id)),
    { kind: "system", text: `The project “${p.title}” was deleted.`, href: "/projects" },
  );
  return json({ ok: true });
});
