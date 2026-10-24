import { requireUser } from "@/lib/auth";
import { route, json } from "@/lib/api";
import { collections } from "@/lib/db";
import { connectionDTO, loadMiniUsers } from "@/lib/serialize";

/** Connections added by others whose fields overlap mine, most overlap first. */
export const GET = route(async () => {
  const user = await requireUser();
  if (!user.fields.length) return json({ items: [] });
  const { connections } = await collections();
  const docs = await connections.find({ fields: { $in: user.fields }, addedBy: { $ne: user._id } }).limit(200).toArray();
  const scored = docs
    .map((d) => ({ d, overlap: d.fields.filter((f) => user.fields.includes(f)) }))
    .sort((a, b) => b.overlap.length - a.overlap.length || b.d.createdAt.getTime() - a.d.createdAt.getTime())
    .slice(0, 12);
  const owners = await loadMiniUsers(scored.map((s) => s.d.addedBy));
  return json({ items: scored.map((s) => connectionDTO(s.d, user._id, owners, s.overlap)) });
});
