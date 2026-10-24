import { z } from "zod";
import { requireAdmin, ApiError, accessStatus, isAdminEmail } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { deleteUserCascade } from "@/lib/users";
import { matchProfile } from "@/lib/matching";
import { sendApprovedEmail } from "@/lib/accounts";
import { getSettings } from "@/lib/settings";
import { photoUrlFor } from "@/lib/serialize";

export const maxDuration = 60;

/** Everyone who has confirmed their email, with what admins need to approve and organise them. */
export const GET = route(async () => {
  await requireAdmin();
  const { users, opportunities, matches, proposals, scholarships } = await collections();
  const settings = await getSettings();
  const all = await users.find({ emailVerifiedAt: { $ne: null } }).sort({ createdAt: -1 }).limit(3000).toArray();
  const count = (rows: { _id: unknown; n: number }[]) => new Map(rows.map((r) => [String(r._id), r.n]));
  const [posted, matched, proposed, tracked] = await Promise.all([
    opportunities.aggregate<{ _id: unknown; n: number }>([{ $group: { _id: "$postedBy", n: { $sum: 1 } } }]).toArray(),
    matches.aggregate<{ _id: unknown; n: number }>([{ $match: { dismissed: false } }, { $group: { _id: "$userId", n: { $sum: 1 } } }]).toArray(),
    proposals.aggregate<{ _id: unknown; n: number }>([{ $group: { _id: "$proposedBy", n: { $sum: 1 } } }]).toArray(),
    scholarships.aggregate<{ _id: unknown; n: number }>([{ $group: { _id: "$userId", n: { $sum: 1 } } }]).toArray(),
  ]);
  const p = count(posted), m = count(matched), pr = count(proposed), sc = count(tracked);
  const label = (id: string | null) => (id ? settings.batches.find((b) => b.id === id)?.label ?? id : null);
  return json({
    items: all.map((u) => ({
      id: String(u._id),
      email: u.email,
      name: u.name,
      photoUrl: photoUrlFor(u),
      status: accessStatus(u),
      isAdmin: isAdminEmail(u.email),
      role: u.role ?? "participant",
      teamTitle: u.teamTitle ?? null,
      batch: u.batch ?? null,
      batchLabel: label(u.batch ?? null),
      signupHint: { batch: u.signupHint?.batch ?? null, batchLabel: label(u.signupHint?.batch ?? null), saysTeam: Boolean(u.signupHint?.saysTeam) },
      onboarded: u.onboarded,
      university: u.university ?? "",
      city: u.city ?? "",
      fieldOfStudy: u.fieldOfStudy ?? "",
      createdAt: u.createdAt?.toISOString() ?? null,
      lastSeenAt: u.lastSeenAt ? new Date(u.lastSeenAt).toISOString() : null,
      posted: p.get(String(u._id)) ?? 0,
      proposals: pr.get(String(u._id)) ?? 0,
      scholarships: sc.get(String(u._id)) ?? 0,
      matches: m.get(String(u._id)) ?? 0,
    })),
  });
});

const patchSchema = z
  .object({
    ids: z.array(z.string()).min(1).max(1000),
    status: z.enum(["pending", "approved", "rejected"]).optional(),
    role: z.enum(["participant", "team"]).optional(),
    teamTitle: z.string().trim().max(60).nullable().optional(),
    batch: z.string().trim().max(40).nullable().optional(),
    /** Bulk approval: put each person in the batch they chose at sign-up. */
    useSignupBatch: z.boolean().optional(),
  })
  .refine((v) => v.status || v.role || v.teamTitle !== undefined || v.batch !== undefined || v.useSignupBatch, "Nothing to change");

/** Approve / decline / revoke, and set role, team title and batch — for one person or many. */
export const PATCH = route(async (req) => {
  const admin = await requireAdmin();
  const body = await readJson(req, patchSchema);
  const settings = await getSettings();
  if (body.batch && !settings.batches.some((b) => b.id === body.batch)) throw new ApiError(400, "That batch doesn't exist. Add it in Admin → Access first.");
  const ids = body.ids.map(toObjectId).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const { users } = await collections();
  const targets = await users
    .find({ _id: { $in: ids }, emailVerifiedAt: { $ne: null } }, { projection: { email: 1, status: 1, onboarded: 1, name: 1, signupHint: 1 } })
    .toArray();
  // Admins' access can't be changed here (it comes from ADMIN_EMAILS), but their role/title can.
  const statusChangeable = targets.filter((u) => !isAdminEmail(u.email) && String(u._id) !== String(admin._id));
  const now = new Date();
  const set: Record<string, unknown> = { updatedAt: now };
  if (body.role) set.role = body.role;
  if (body.teamTitle !== undefined) set.teamTitle = body.teamTitle || null;
  if (body.role === "participant") set.teamTitle = null;
  if (body.batch !== undefined) set.batch = body.batch || null;
  if (Object.keys(set).length > 1) await users.updateMany({ _id: { $in: targets.map((u) => u._id) } }, { $set: set });
  if (body.useSignupBatch) {
    const valid = new Set(settings.batches.map((b) => b.id));
    await Promise.all(
      targets
        .filter((u) => u.signupHint?.batch && valid.has(u.signupHint.batch))
        .map((u) => users.updateOne({ _id: u._id }, { $set: { batch: u.signupHint.batch } })),
    );
  }
  if (body.status) {
    await users.updateMany({ _id: { $in: statusChangeable.map((u) => u._id) } }, { $set: { status: body.status, statusChangedAt: now } });
    if (body.status === "approved") {
      const newlyApproved = statusChangeable.filter((u) => u.status !== "approved");
      await Promise.all(newlyApproved.map((u) => sendApprovedEmail(u).catch(() => null)));
      for (const u of newlyApproved.filter((x) => x.onboarded)) await matchProfile(u._id).catch(() => null);
    }
  }
  return json({ updated: body.status ? statusChangeable.length : targets.length });
});

const deleteSchema = z.object({ id: z.string(), confirm: z.literal("DELETE", { error: "Type DELETE to confirm" }) });

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
