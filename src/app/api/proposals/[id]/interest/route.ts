import { z } from "zod";
import { requireUser, ApiError } from "@/lib/auth";
import { route, readJson, json, type IdCtx } from "@/lib/api";
import { collections } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { notify } from "@/lib/notify";
import { interestBlocker } from "@/lib/proposals";
import { loadProposal } from "@/lib/proposal-load";
import { containsContactDetails } from "@/lib/pii";
import { firstName } from "@/lib/client-safe";

const schema = z.object({
  note: z
    .string()
    .trim()
    .max(400)
    .refine((v) => !containsContactDetails(v), "Please don't share phone numbers or emails here. Use Connect to swap contacts.")
    .default(""),
});

/** "I'm interested" (or accepting an invite). Tells the proposer, with what you can bring. */
export const POST = route(async (req, ctx: IdCtx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const p = await loadProposal(id);
  const { note } = await readJson(req, schema);
  const { proposalMembers } = await collections();
  const existing = await proposalMembers.findOne({ proposalId: p._id, userId: user._id });
  const blocker = interestBlocker(p, String(user._id), existing?.status ?? null);
  if (blocker) throw new ApiError(409, blocker);
  await rateLimit("interest", String(user._id), { exempt: user.isAdmin });
  const now = new Date();
  await proposalMembers.updateOne(
    { proposalId: p._id, userId: user._id },
    { $set: { status: "interested", note, decidedAt: null }, $setOnInsert: { invitedBy: null, createdAt: now } },
    { upsert: true },
  );
  if (p.proposedBy) {
    await notify([p.proposedBy], {
      kind: "interest",
      text: `${user.name} is interested in “${p.title}”${note ? `: “${note.slice(0, 120)}”` : "."}`,
      href: `/projects/${id}#manage`,
      email: {
        subject: `${firstName(user.name)} is interested in ${p.title}`,
        heading: `${user.name} wants to join your project`,
        lines: [`They're interested in “${p.title}”.`, "Accept or decline them from the project page."],
        quote: note || null,
        cta: "Review on Comskills Circle",
      },
    });
  }
  return json({ status: "interested" });
});

/** Withdraw interest, decline an invite, or leave the team. */
export const DELETE = route(async (_req, ctx: IdCtx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const p = await loadProposal(id);
  const { proposalMembers } = await collections();
  const m = await proposalMembers.findOne({ proposalId: p._id, userId: user._id });
  if (!m || !["interested", "accepted", "invited"].includes(m.status)) throw new ApiError(404, "You're not part of this project.");
  await proposalMembers.updateOne({ _id: m._id }, { $set: { status: "left", decidedAt: new Date() } });
  if (m.status === "accepted" && p.proposedBy) {
    await notify([p.proposedBy], { kind: "memberLeft", text: `${user.name} left the team for “${p.title}”.`, href: `/projects/${id}#manage` });
  }
  return json({ status: "left" });
});
