import { z } from "zod";
import { requireUser, ApiError, ACTIVE_MEMBER } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { pairKey } from "@/lib/visibility";
import { connectRequestDTO, loadMiniUsers } from "@/lib/serialize";
import { notify } from "@/lib/notify";
import { firstName } from "@/lib/client-safe";

/** Your connect requests: incoming waiting for you first, then the rest. */
export const GET = route(async () => {
  const user = await requireUser();
  const { connectRequests } = await collections();
  const docs = await connectRequests
    .find({ $or: [{ to: user._id }, { from: user._id }] })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  const people = await loadMiniUsers(docs.flatMap((d) => [d.from, d.to]));
  const items = docs.map((d) => connectRequestDTO(d, user._id, people));
  return json({ items });
});

const bodySchema = z.object({ to: z.string(), message: z.string().trim().max(300).default("") });

/** Ask to connect. Contacts stay hidden until the other person accepts. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson(req, bodySchema);
  const to = toObjectId(body.to);
  if (!to || String(to) === String(user._id)) throw new ApiError(400, "You can't connect with yourself.");
  const { users, connectRequests } = await collections();
  const other = await users.findOne({ _id: to, ...ACTIVE_MEMBER }, { projection: { name: 1 } });
  if (!other) throw new ApiError(404, "Member not found.");
  const between = await connectRequests.find({ $or: [{ from: user._id, to }, { from: to, to: user._id }] }).toArray();
  if (between.some((r) => r.status === "accepted")) throw new ApiError(409, "You're already connected.");
  if (between.some((r) => r.status === "pending" && String(r.from) === String(user._id))) throw new ApiError(409, "You've already sent a request. Wait for them to reply.");
  if (between.some((r) => r.status === "declined" && String(r.from) === String(user._id))) {
    throw new ApiError(409, "They didn't accept your earlier request. If they want to connect, they can ask you.");
  }
  const now = new Date();
  // They already asked you: accept theirs instead of creating a second request
  const theirs = between.find((r) => r.status === "pending" && String(r.from) === String(to));
  if (theirs) {
    await connectRequests.updateOne({ _id: theirs._id }, { $set: { status: "accepted", decidedAt: now } });
    await notify([to], {
      kind: "connectAccepted",
      text: `${user.name} accepted your connect request. You can now see each other's contacts.`,
      href: `/members/${String(user._id)}`,
      email: { subject: `${firstName(user.name)} accepted your connect request`, heading: "You're connected", lines: [`${user.name} accepted. You can now see each other's WhatsApp and email.`], cta: "See their profile" },
    });
    return json({ status: "accepted", id: String(theirs._id) });
  }
  await rateLimit("connect", String(user._id), { exempt: user.isAdmin });
  let id;
  try {
    id = (
      await connectRequests.insertOne({ from: user._id, to, pairKey: pairKey(String(user._id), String(to)), message: body.message, status: "pending", createdAt: now, decidedAt: null } as never)
    ).insertedId;
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw new ApiError(409, "There's already a pending request between you two.");
    throw e;
  }
  await notify([to], {
    kind: "connectRequest",
    text: `${user.name} wants to connect${body.message ? `: “${body.message.slice(0, 120)}”` : "."}`,
    href: "/inbox?tab=requests",
    email: {
      subject: `${firstName(user.name)} wants to connect on Comskills Circle`,
      heading: `${user.name} wants to connect`,
      lines: ["If you accept, you'll both see each other's WhatsApp and email."],
      quote: body.message || null,
      cta: "Reply in your inbox",
    },
  });
  return json({ status: "pending", id: String(id) }, { status: 201 });
});
