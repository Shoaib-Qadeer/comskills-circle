import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { collections } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { onlyValidFields } from "@/lib/taxonomy";
import { getSettings } from "@/lib/settings";
import { matchProposal } from "@/lib/matching";
import { loadProposalContext, proposalCardDTO, proposalInputSchema } from "@/lib/proposals";
import type { ProposalDoc } from "@/lib/types";

export const maxDuration = 60;

/**
 * The project board. tab=active (default) | completed | mine. Returns every proposal in the tab
 * (a few hundred at most) so filters run on the phone; "Suggested for you" first, then newest.
 */
export const GET = route(async (req) => {
  const user = await requireUser();
  const tab = new URL(req.url).searchParams.get("tab") || "active";
  const { proposals, proposalMembers } = await collections();
  let filter: Record<string, unknown>;
  if (tab === "completed") filter = { status: "completed" };
  else if (tab === "mine") {
    const mine = await proposalMembers.find({ userId: user._id, status: { $in: ["accepted", "interested", "invited"] } }, { projection: { proposalId: 1 } }).toArray();
    filter = { $or: [{ proposedBy: user._id }, { _id: { $in: mine.map((m) => m.proposalId) } }] };
  } else filter = { status: { $ne: "completed" } };
  const docs = await proposals.find(filter).sort({ createdAt: -1 }).limit(500).toArray();
  const ctx = await loadProposalContext(docs, user._id);
  const settings = await getSettings();
  const items = docs.map((p) =>
    proposalCardDTO(p, user._id, {
      people: ctx.people,
      acceptedIds: ctx.acceptedBy.get(String(p._id)) ?? [],
      myStatus: ctx.myStatus.get(String(p._id)) ?? null,
      match: ctx.matchBy.get(String(p._id)) ?? null,
    }),
  );
  const t = settings.ai.matchThreshold;
  const suggested = (x: (typeof items)[number]) => (x.match && x.match.score >= t && !x.proposedByMe && x.myStatus !== "accepted" && x.acceptingMembers ? x.match.score : -1);
  items.sort((a, b) => suggested(b) - suggested(a) || b.createdAt.localeCompare(a.createdAt));
  return json({ items, threshold: t });
});

/** Propose a project. Matching runs after the response; the proposer then sees "People who might fit". */
export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson(req, proposalInputSchema);
  await rateLimit("proposal", String(user._id), { exempt: user.isAdmin });
  const now = new Date();
  const doc: Omit<ProposalDoc, "_id"> = {
    proposedBy: user._id,
    title: body.title,
    problem: body.problem,
    idea: body.idea,
    peopleNeeded: body.peopleNeeded,
    commitment: body.commitment,
    fields: onlyValidFields(body.fields).slice(0, 4),
    tags: body.tags,
    links: body.links,
    status: "open",
    acceptingMembers: true,
    statusChangedAt: now,
    matchCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  const { proposals, users } = await collections();
  const { insertedId } = await proposals.insertOne(doc as ProposalDoc);
  const firstPost = !user.hasPosted;
  if (firstPost) await users.updateOne({ _id: user._id }, { $set: { hasPosted: true } });
  after(async () => {
    try {
      await matchProposal(insertedId);
    } catch (e) {
      console.error("[match new proposal]", e);
    }
  });
  return json({ id: String(insertedId), firstPost }, { status: 201 });
});
