import { z } from "zod";
import { requireUser, adminEmails } from "@/lib/auth";
import { route, readJson, json, type IdCtx } from "@/lib/api";
import { collections } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { notify } from "@/lib/notify";
import { loadProposal } from "@/lib/proposal-load";

const schema = z.object({ reason: z.string().trim().min(5, "Tell the admins what's wrong (a few words)").max(500) });

/** Flags a proposal for the admins (Admin → Content). The proposer isn't told who reported it. */
export const POST = route(async (req, ctx: IdCtx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const p = await loadProposal(id);
  const { reason } = await readJson(req, schema);
  await rateLimit("report", String(user._id), { exempt: user.isAdmin });
  const { reports, users } = await collections();
  await reports.insertOne({ kind: "proposal", targetId: p._id, reporterId: user._id, reason, resolved: false, createdAt: new Date() } as never);
  const admins = await users.find({ email: { $in: adminEmails() } }, { projection: { _id: 1 } }).toArray();
  await notify(
    admins.map((a) => a._id),
    { kind: "system", text: `A project was reported: “${p.title}”.`, href: "/admin?tab=content" },
  );
  return json({ ok: true }, { status: 201 });
});
