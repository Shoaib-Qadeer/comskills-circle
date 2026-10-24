import type { ObjectId } from "mongodb";
import { collections } from "./db";

/**
 * Removes a person and everything personal they created: profile, photo, matches, connect
 * requests, notifications, scholarship entries, reactions, their project memberships and their
 * own proposals (with those proposals' members and matches). Opportunities they shared and
 * announcements they wrote stay for the community, without their name.
 */
export async function deleteUserCascade(userId: ObjectId) {
  const c = await collections();
  const ownProposals = (await c.proposals.find({ proposedBy: userId }, { projection: { _id: 1 } }).toArray()).map((p) => p._id);
  const myReactions = await c.reactions.find({ userId }, { projection: { announcementId: 1, emoji: 1 } }).toArray();
  await Promise.all([
    c.matches.deleteMany({ userId }),
    c.matches.deleteMany({ kind: "proposal", targetId: { $in: ownProposals } } as never),
    c.photos.deleteOne({ _id: userId }),
    c.connectRequests.deleteMany({ $or: [{ from: userId }, { to: userId }] }),
    c.notifications.deleteMany({ userId }),
    c.proposalMembers.deleteMany({ $or: [{ userId }, { proposalId: { $in: ownProposals } }] }),
    c.proposalMembers.updateMany({ invitedBy: userId }, { $set: { invitedBy: null } }),
    c.proposals.deleteMany({ _id: { $in: ownProposals } }),
    c.scholarships.deleteMany({ userId }),
    c.reactions.deleteMany({ userId }),
    ...myReactions.map((r) => c.announcements.updateOne({ _id: r.announcementId }, { $inc: { [`reactionCounts.${r.emoji}`]: -1 } })),
    c.announcements.updateMany({ authorId: userId }, { $set: { authorId: null } }),
    c.reports.updateMany({ reporterId: userId }, { $set: { reporterId: null } }),
    c.opportunities.updateMany({ postedBy: userId }, { $set: { postedBy: null, posterNote: null } }),
    c.opportunities.updateMany({ taggedFor: userId }, { $pull: { taggedFor: userId } }),
    c.matches.updateMany({ taggedBy: userId }, { $set: { taggedBy: null } }),
  ]);
  await c.users.deleteOne({ _id: userId });
}
