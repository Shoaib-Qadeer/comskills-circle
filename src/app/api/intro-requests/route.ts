import { requireUser, ApiError } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { introRequestSchema } from "@/lib/schemas";
import { introDTO, loadMiniUsers } from "@/lib/serialize";
import { rateLimit } from "@/lib/ratelimit";
import type { IntroRequestDoc } from "@/lib/types";

export const GET = route(async (req) => {
  const user = await requireUser();
  const box = new URL(req.url).searchParams.get("box") === "outgoing" ? "outgoing" : "incoming";
  const { introRequests, connections } = await collections();
  const docs = await introRequests
    .find(box === "incoming" ? { addedBy: user._id } : { requesterId: user._id })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  const conns = await connections.find({ _id: { $in: docs.map((d) => d.connectionId) } }).toArray();
  const people = await loadMiniUsers(docs.flatMap((d) => [d.requesterId, d.addedBy]));
  return json({ items: docs.map((d) => introDTO(d, new Map(conns.map((c) => [String(c._id), c])), people)) });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson(req, introRequestSchema);
  const cid = toObjectId(body.connectionId);
  if (!cid) throw new ApiError(404, "Connection not found");
  const { connections, introRequests } = await collections();
  const conn = await connections.findOne({ _id: cid });
  if (!conn) throw new ApiError(404, "Connection not found");
  if (String(conn.addedBy) === String(user._id)) throw new ApiError(400, "This is your own connection.");
  const existing = await introRequests.findOne({ connectionId: cid, requesterId: user._id, status: "pending" });
  if (existing) throw new ApiError(409, "You already have a pending request for this person.");
  await rateLimit("intro", String(user._id), { exempt: user.isAdmin });
  const now = new Date();
  const doc: Omit<IntroRequestDoc, "_id"> = {
    connectionId: cid,
    requesterId: user._id,
    addedBy: conn.addedBy,
    message: body.message,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await introRequests.insertOne(doc as IntroRequestDoc);
  return json({ id: String(insertedId) }, { status: 201 });
});
