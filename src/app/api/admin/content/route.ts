import { z } from "zod";
import { requireAdmin, ApiError } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { loadMiniUsers, opportunityDTO } from "@/lib/serialize";
import { STAGE_LABEL } from "@/lib/scholarships";
import { batchLabel, getSettings } from "@/lib/settings";

const TYPES = ["opportunities", "proposals", "news", "scholarships", "reports"] as const;
type ContentType = (typeof TYPES)[number];

/** Lists for moderation. ?type= one of opportunities | proposals | news | scholarships | reports; ?q= filters by title/name. */
export const GET = route(async (req) => {
  const admin = await requireAdmin();
  const url = new URL(req.url);
  const type = (TYPES.includes(url.searchParams.get("type") as ContentType) ? url.searchParams.get("type") : "opportunities") as ContentType;
  const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
  const re = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
  const c = await collections();

  if (type === "opportunities") {
    const opps = await c.opportunities.find(re ? { $or: [{ title: re }, { organization: re }] } : {}).sort({ createdAt: -1 }).limit(500).toArray();
    const people = await loadMiniUsers(opps.map((o) => o.postedBy));
    return json({ type, items: opps.map((o) => opportunityDTO(o, admin, people)) });
  }
  if (type === "proposals") {
    const props = await c.proposals.find(re ? { title: re } : {}).sort({ createdAt: -1 }).limit(500).toArray();
    const [people, open] = await Promise.all([
      loadMiniUsers(props.map((p) => p.proposedBy)),
      c.reports.aggregate<{ _id: unknown; n: number }>([{ $match: { resolved: false } }, { $group: { _id: "$targetId", n: { $sum: 1 } } }]).toArray(),
    ]);
    const reportsBy = new Map(open.map((r) => [String(r._id), r.n]));
    return json({
      type,
      items: props.map((p) => ({
        id: String(p._id),
        title: p.title,
        status: p.status,
        proposer: p.proposedBy ? people.get(String(p.proposedBy))?.name ?? null : null,
        matchCount: p.matchCount ?? 0,
        openReports: reportsBy.get(String(p._id)) ?? 0,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  }
  if (type === "news") {
    const posts = await c.announcements.find(re ? { title: re } : {}).sort({ createdAt: -1 }).limit(500).toArray();
    const people = await loadMiniUsers(posts.map((a) => a.authorId));
    return json({
      type,
      items: posts.map((a) => ({
        id: String(a._id),
        title: a.title,
        category: a.category,
        pinned: a.pinned,
        author: a.authorId ? people.get(String(a.authorId))?.name ?? null : null,
        emailedCount: a.emailedCount ?? 0,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  }
  if (type === "scholarships") {
    // Admins see team-only rejections too (as on the Team page)
    const rows = await c.scholarships.find(re ? { $or: [{ name: re }, { country: re }] } : {}).sort({ updatedAt: -1 }).limit(1000).toArray();
    const [people, settings, owners] = await Promise.all([
      loadMiniUsers(rows.map((s) => s.userId)),
      getSettings(),
      c.users.find({ _id: { $in: rows.map((s) => s.userId) } }, { projection: { batch: 1 } }).toArray(),
    ]);
    const batchOf = new Map(owners.map((o) => [String(o._id), batchLabel(settings, o.batch)]));
    return json({
      type,
      items: rows.map((s) => ({
        id: String(s._id),
        name: s.name,
        country: s.country,
        stage: STAGE_LABEL[s.stage],
        owner: people.get(String(s.userId))?.name ?? null,
        batch: batchOf.get(String(s.userId)) ?? null,
        teamOnly: s.stage === "rejected" && s.rejectedVisibility !== "members",
        updatedAt: s.updatedAt.toISOString(),
      })),
    });
  }
  // reports
  const reports = await c.reports.find({}).sort({ resolved: 1, createdAt: -1 }).limit(300).toArray();
  const [props, people] = await Promise.all([
    c.proposals.find({ _id: { $in: reports.map((r) => r.targetId) } }, { projection: { title: 1 } }).toArray(),
    loadMiniUsers(reports.map((r) => r.reporterId)),
  ]);
  const titleOf = new Map(props.map((p) => [String(p._id), p.title]));
  return json({
    type,
    items: reports.map((r) => ({
      id: String(r._id),
      proposalId: String(r.targetId),
      proposalTitle: titleOf.get(String(r.targetId)) ?? null,
      reporter: r.reporterId ? people.get(String(r.reporterId))?.name ?? null : null,
      reason: r.reason,
      resolved: r.resolved,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("resolveReport"), id: z.string(), resolved: z.boolean().default(true) }),
  z.object({ action: z.literal("deleteScholarship"), id: z.string() }),
]);

export const POST = route(async (req) => {
  await requireAdmin();
  const body = await readJson(req, actionSchema);
  const id = toObjectId(body.id);
  if (!id) throw new ApiError(404, "Not found");
  const { reports, scholarships, announcements } = await collections();
  if (body.action === "resolveReport") {
    const r = await reports.updateOne({ _id: id }, { $set: { resolved: body.resolved } });
    if (!r.matchedCount) throw new ApiError(404, "Not found");
    return json({ ok: true });
  }
  const r = await scholarships.deleteOne({ _id: id });
  if (!r.deletedCount) throw new ApiError(404, "Not found");
  await announcements.updateMany({ scholarshipId: id }, { $set: { scholarshipId: null } });
  return json({ ok: true });
});
