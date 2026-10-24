import type { ObjectId } from "mongodb";
import { collections } from "./db";

/**
 * Removes a person and everything personal they created. Opportunities they shared stay
 * for the class but are anonymized ("shared by a former member").
 */
export async function deleteUserCascade(userId: ObjectId) {
  const c = await collections();
  const myConnections = await c.connections.find({ addedBy: userId }, { projection: { _id: 1 } }).toArray();
  await Promise.all([
    c.matches.deleteMany({ userId }),
    c.introRequests.deleteMany({
      $or: [{ requesterId: userId }, { addedBy: userId }, { connectionId: { $in: myConnections.map((x) => x._id) } }],
    }),
    c.connections.deleteMany({ addedBy: userId }),
    c.opportunities.updateMany({ postedBy: userId }, { $set: { postedBy: null, posterNote: null } }),
    c.opportunities.updateMany({ taggedFor: userId }, { $pull: { taggedFor: userId } }),
    c.matches.updateMany({ taggedBy: userId }, { $set: { taggedBy: null } }),
  ]);
  await c.users.deleteOne({ _id: userId });
}
