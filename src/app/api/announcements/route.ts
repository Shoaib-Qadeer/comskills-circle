import { after } from "next/server";
import { requireUser, requireTeam, ApiError, ACTIVE_MEMBER } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { notify } from "@/lib/notify";
import { announcementDTO, announcementInputSchema, broadcastAnnouncement, emptyReactions, loadAuthors, pinnedUntilDate, sortFeed } from "@/lib/news";
import type { AnnouncementDoc, Reaction } from "@/lib/types";

export const maxDuration = 60;

/** The feed: pinned posts on top, then newest first. ?category= filters. */
export const GET = route(async (req) => {
  const user = await requireUser();
  const category = new URL(req.url).searchParams.get("category");
  const { announcements, reactions } = await collections();
  const docs = await announcements.find(category ? { category: category as AnnouncementDoc["category"] } : {}).sort({ createdAt: -1 }).limit(150).toArray();
  const sorted = sortFeed(docs);
  const [authors, mine] = await Promise.all([
    loadAuthors(sorted.map((a) => a.authorId)),
    reactions.find({ userId: user._id, announcementId: { $in: sorted.map((a) => a._id) } }, { projection: { announcementId: 1, emoji: 1 } }).toArray(),
  ]);
  const mineBy = new Map<string, Reaction[]>();
  mine.forEach((r) => mineBy.set(String(r.announcementId), [...(mineBy.get(String(r.announcementId)) ?? []), r.emoji]));
  const seenAt = user.seen?.announcementsAt ?? null;
  return json({ items: sorted.map((a) => announcementDTO(a, { _id: user._id, isAdmin: user.isAdmin, seenAt }, { authors, mine: mineBy.get(String(a._id)) ?? [] })) });
});

/** Only the Comskills team and admins can post. */
export const POST = route(async (req) => {
  const user = await requireTeam();
  const body = await readJson(req, announcementInputSchema);
  await rateLimit("announce", String(user._id), { exempt: user.isAdmin });
  const { announcements, scholarships, users } = await collections();

  let scholarshipId = null;
  if (body.scholarshipId) {
    scholarshipId = toObjectId(body.scholarshipId);
    const s = scholarshipId ? await scholarships.findOne({ _id: scholarshipId }) : null;
    if (!s || s.stage !== "accepted" || !s.announceConsent) throw new ApiError(400, "That win can't be announced: the member hasn't agreed, or it's no longer accepted.");
    if (s.announcedAt) throw new ApiError(409, "That win was already announced.");
  }
  const now = new Date();
  const doc: Omit<AnnouncementDoc, "_id"> = {
    authorId: user._id,
    title: body.title,
    body: body.body,
    category: scholarshipId ? "win" : body.category,
    link: body.link,
    pinned: body.pinned,
    pinnedUntil: body.pinned ? pinnedUntilDate(body.pinnedUntil) : null,
    reactionCounts: emptyReactions(),
    emailedAt: null,
    emailedCount: 0,
    scholarshipId,
    createdAt: now,
    editedAt: null,
  };
  const { insertedId } = await announcements.insertOne(doc as AnnouncementDoc);
  const saved = { ...(doc as AnnouncementDoc), _id: insertedId };
  if (scholarshipId) await scholarships.updateOne({ _id: scholarshipId }, { $set: { announcedAt: now } });
  // The author has obviously seen it
  await users.updateOne({ _id: user._id }, { $set: { "seen.announcementsAt": now } });

  // Pinned + "email everyone": an in-app notification for everyone too
  if (body.pinned && body.emailEveryone) {
    const everyone = await users.find({ ...ACTIVE_MEMBER, _id: { $ne: user._id } }, { projection: { _id: 1 } }).toArray();
    await notify(
      everyone.map((u) => u._id),
      { kind: "announcement", text: `📣 ${body.title}`, href: `/news#a-${String(insertedId)}` },
    );
  }
  if (body.emailEveryone) {
    after(async () => {
      try {
        const r = await broadcastAnnouncement(saved);
        console.info(`[news] emailed ${r.sent} members${r.stoppedBy ? ` (stopped: ${r.stoppedBy})` : ""}`);
      } catch (e) {
        console.error("[news broadcast]", e);
      }
    });
  }
  return json({ id: String(insertedId), emailing: body.emailEveryone }, { status: 201 });
});
