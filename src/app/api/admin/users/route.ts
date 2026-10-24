import { z } from "zod";
import { requireAdmin, ApiError, accessStatus, isAdminEmail } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { deleteUserCascade } from "@/lib/users";
import { matchProfile } from "@/lib/matching";

export const maxDuration = 60;

export const GET = route(async () => {
  await requireAdmin();
  const { users, opportunities, connections, matches } = await collections();
  const all = await users.find({}).sort({ createdAt: -1 }).limit(1000).toArray();
  const [posted, added, matched] = await Promise.all([
    opportunities.aggregate<{ _id: unknown; n: number }>([{ $group: { _id: "$postedBy", n: { $sum: 1 } } }]).toArray(),
    connections.aggregate<{ _id: unknown; n: number }>([{ $group: { _id: "$addedBy", n: { $sum: 1 } } }]).toArray(),
    matches.aggregate<{ _id: unknown; n: number }>([{ $match: { dismissed: false } }, { $group: { _id: "$userId", n: { $sum: 1 } } }]).toArray(),
  ]);
  const count = (rows: { _id: unknown; n: number }[]) => new Map(rows.map((r) => [String(r._id), r.n]));
  const p = count(posted), a = count(added), m = count(matched);
  return json({
    items: all.map((u) => ({
      id: String(u._id),
      email: u.email,
      name: u.name,
      photoUrl: u.photoUrl,
      status: accessStatus(u),
      isAdmin: isAdminEmail(u.email),
      onboarded: u.onboarded,
      visibility: u.visibility,
      headline: u.headline,
      fields: u.fields,
      createdAt: u.createdAt?.toISOString() ?? null,
      lastSeenAt: u.lastSeenAt ? new Date(u.lastSeenAt).toISOString() : null,
      posted: p.get(String(u._id)) ?? 0,
      connections: a.get(String(u._id)) ?? 0,
      matches: m.get(String(u._id)) ?? 0,
    })),
  });
});

const patchSchema = z.object({
  ids: z.array(z.string()).min(1).max(500),
  status: z.enum(["pending", "approved", "rejected"]),
});

/** Approve, reject or move people back to pending (one or many at once). */
export const PATCH = route(async (req) => {
  const admin = await requireAdmin();
  const body = await readJson(req, patchSchema);
  const ids = body.ids.map(toObjectId).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const { users } = await collections();
  const targets = await users.find({ _id: { $in: ids } }, { projection: { email: 1, status: 1, onboarded: 1 } }).toArray();
  const changeable = targets.filter((u) => !isAdminEmail(u.email) && String(u._id) !== String(admin._id));
  await users.updateMany({ _id: { $in: changeable.map((u) => u._id) } }, { $set: { status: body.status, statusChangedAt: new Date() } });
  // Newly approved people who already filled in their profile get matched straight away
  if (body.status === "approved") {
    for (const u of changeable.filter((x) => x.onboarded)) await matchProfile(u._id).catch(() => null);
  }
  return json({ updated: changeable.length });
});

const deleteSchema = z.object({ id: z.string(), confirm: z.literal("DELETE") });

export const DELETE = route(async (req) => {
  const admin = await requireAdmin();
  const body = await readJson(req, deleteSchema);
  const oid = toObjectId(body.id);
  if (!oid) throw new ApiError(404, "Not found");
  const { users } = await collections();
  const u = await users.findOne({ _id: oid }, { projection: { email: 1 } });
  if (!u) throw new ApiError(404, "Not found");
  if (isAdminEmail(u.email) || String(oid) === String(admin._id)) throw new ApiError(400, "You can't delete an admin account here.");
  await deleteUserCascade(oid);
  return json({ ok: true });
});
