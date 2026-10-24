import type { ObjectId } from "mongodb";
import { collections } from "./db";
import type { ConnectState } from "./types";

/** The connect state between the viewer and another member, from the viewer's side. */
export async function connectStateBetween(viewerId: ObjectId, otherId: ObjectId): Promise<ConnectState> {
  if (String(viewerId) === String(otherId)) return { state: "self" };
  const { connectRequests } = await collections();
  const reqs = await connectRequests
    .find({ $or: [{ from: viewerId, to: otherId }, { from: otherId, to: viewerId }] })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();
  return deriveConnectState(String(viewerId), reqs.map((r) => ({ id: String(r._id), from: String(r.from), to: String(r.to), status: r.status, message: r.message })));
}

/** Pure: newest-first requests between two people → the state the viewer sees. */
export function deriveConnectState(
  viewerId: string,
  reqs: { id: string; from: string; to: string; status: "pending" | "accepted" | "declined"; message: string }[],
): ConnectState {
  if (reqs.some((r) => r.status === "accepted")) return { state: "connected" };
  const pending = reqs.find((r) => r.status === "pending");
  if (pending) return pending.from === viewerId ? { state: "outgoing", requestId: pending.id } : { state: "incoming", requestId: pending.id, message: pending.message };
  // Only the requester sees "declined"; the other person just sees "none" and may ask themselves
  if (reqs.some((r) => r.status === "declined" && r.from === viewerId)) return { state: "declined" };
  return { state: "none" };
}

/** Ids of everyone the viewer is connected with (accepted, either direction). */
export async function connectedIds(viewerId: ObjectId): Promise<Set<string>> {
  const { connectRequests } = await collections();
  const docs = await connectRequests.find({ status: "accepted", $or: [{ from: viewerId }, { to: viewerId }] }, { projection: { from: 1, to: 1 } }).toArray();
  return new Set(docs.map((d) => String(String(d.from) === String(viewerId) ? d.to : d.from)));
}
