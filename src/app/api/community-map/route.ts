import { requireUser } from "@/lib/auth";
import { ACTIVE_MEMBER } from "@/lib/access";
import { route, json } from "@/lib/api";
import { collections } from "@/lib/db";
import { photoUrlFor, safeLinks } from "@/lib/serialize";
import { batchLabel, getSettings } from "@/lib/settings";
import { adminEmails } from "@/lib/auth";
import { buildMapHubs } from "@/lib/community-map";
import type { CommunityMapDTO } from "@/lib/types";

/** Everyone active on the map, with hubs for the Field, Batch and Projects lenses. No contact details. */
export const GET = route(async () => {
  const user = await requireUser();
  const { users, proposals, proposalMembers } = await collections();
  const [people, props, settings] = await Promise.all([
    users.find(ACTIVE_MEMBER, { projection: { name: 1, email: 1, fields: 1, batch: 1, role: 1, teamTitle: 1, fieldOfStudy: 1, hasPhoto: 1, photoVersion: 1, links: 1, volunteering: 1 } }).toArray(),
    proposals.find({ status: { $ne: "completed" } }, { projection: { title: 1, status: 1, proposedBy: 1 } }).toArray(),
    getSettings(),
  ]);
  const admins = new Set(adminEmails());
  const accepted = props.length ? await proposalMembers.find({ proposalId: { $in: props.map((p) => p._id) }, status: "accepted" }, { projection: { proposalId: 1, userId: 1 } }).toArray() : [];
  const acceptedBy = new Map<string, string[]>();
  for (const a of accepted) acceptedBy.set(String(a.proposalId), [...(acceptedBy.get(String(a.proposalId)) ?? []), String(a.userId)]);
  const withAdmin = people.map((u) => ({ ...u, isAdmin: admins.has(u.email.toLowerCase()) }));
  const { hubsOf, lenses } = buildMapHubs(withAdmin, props, acceptedBy, (id) => batchLabel(settings, id));
  const payload: CommunityMapDTO = {
    people: withAdmin.map((u) => {
      const team = u.role === "team" || u.isAdmin;
      return {
        id: String(u._id),
        name: u.name,
        photoUrl: photoUrlFor(u),
        headline: u.fieldOfStudy || "",
        fields: u.fields,
        batchLabel: team ? null : batchLabel(settings, u.batch),
        teamTitle: team ? u.teamTitle || (u.isAdmin ? "Comskills team" : null) : null,
        isTeam: team,
        hubs: hubsOf.get(String(u._id))!,
        links: safeLinks(u.links),
        open: Boolean(u.volunteering?.open),
        isMe: String(u._id) === String(user._id),
      };
    }),
    lenses,
  };
  return json(payload);
});
