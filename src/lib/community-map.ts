import { getField } from "./taxonomy";
import type { CommunityMapDTO, MapHub, ProposalDoc, UserDoc } from "./types";

export const BATCH_COLORS = ["#F2C14E", "#5EEAD4", "#A78BFA", "#38BDF8", "#FB7185", "#4ADE80", "#FDBA74", "#C084FC"];
export const TEAM_HUB = "team";
export const NO_BATCH_HUB = "none";

type MapUser = Pick<UserDoc, "_id" | "name" | "fields" | "batch" | "role" | "isAdmin"> & { teamTitle?: string | null };

/**
 * Pure: which hubs each person belongs to under each lens, and the hub lists with counts.
 * - field: taxonomy fields
 * - batch: their batch; team members and admins get the "Comskills team" hub instead
 * - project: active (not completed) proposals they lead or were accepted into
 */
export function buildMapHubs(
  people: MapUser[],
  projects: Pick<ProposalDoc, "_id" | "title" | "status" | "proposedBy">[],
  acceptedBy: Map<string, string[]>,
  batchName: (id: string) => string | null,
): { hubsOf: Map<string, CommunityMapDTO["people"][number]["hubs"]>; lenses: CommunityMapDTO["lenses"] } {
  const hubsOf = new Map<string, CommunityMapDTO["people"][number]["hubs"]>();
  for (const u of people) {
    const team = u.role === "team" || u.isAdmin;
    hubsOf.set(String(u._id), { field: [...u.fields], batch: [team ? TEAM_HUB : u.batch ? `b:${u.batch}` : NO_BATCH_HUB], project: [] });
  }
  const active = projects.filter((p) => p.status !== "completed");
  for (const p of active) {
    const ids = new Set([...(p.proposedBy ? [String(p.proposedBy)] : []), ...(acceptedBy.get(String(p._id)) ?? [])]);
    for (const id of ids) hubsOf.get(id)?.project.push(`p:${String(p._id)}`);
  }
  const count = (lens: "field" | "batch" | "project", hub: string) => Array.from(hubsOf.values()).filter((h) => h[lens].includes(hub)).length;

  const fieldIds = Array.from(new Set(people.flatMap((u) => u.fields)));
  const field: MapHub[] = fieldIds.map((slug) => {
    const f = getField(slug);
    return { id: slug, label: f.label, color: f.color, emoji: f.emoji, count: count("field", slug) };
  });
  const batchIds = Array.from(new Set(Array.from(hubsOf.values()).map((h) => h.batch[0])));
  const batch: MapHub[] = batchIds.map((id, i) =>
    id === TEAM_HUB
      ? { id, label: "Comskills team", color: "#F2C14E", emoji: "⭐", count: count("batch", id) }
      : id === NO_BATCH_HUB
        ? { id, label: "No batch yet", color: "#94A3B8", emoji: "•", count: count("batch", id) }
        : { id, label: batchName(id.slice(2)) ?? id.slice(2), color: BATCH_COLORS[(i + 1) % BATCH_COLORS.length], emoji: "🎓", count: count("batch", id) },
  );
  const project: MapHub[] = active
    .map((p, i) => ({ id: `p:${String(p._id)}`, label: p.title.length > 40 ? `${p.title.slice(0, 38)}…` : p.title, color: BATCH_COLORS[i % BATCH_COLORS.length], emoji: "🧪", count: count("project", `p:${String(p._id)}`) }))
    .filter((h) => h.count > 0);
  const byCount = (a: MapHub, b: MapHub) => b.count - a.count || a.label.localeCompare(b.label);
  return { hubsOf, lenses: { field: field.sort(byCount), batch: batch.sort(byCount), project: project.sort(byCount) } };
}
