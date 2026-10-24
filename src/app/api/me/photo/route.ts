import { Binary } from "mongodb";
import { requireUser, ApiError } from "@/lib/auth";
import { route, json } from "@/lib/api";
import { collections } from "@/lib/db";
import { limitWindow } from "@/lib/ratelimit";
import { photoUrlFor } from "@/lib/serialize";

export const MAX_PHOTO_BYTES = 40 * 1024;

/** True if the bytes really are a WebP or JPEG image (don't trust the content-type alone). */
function sniff(buf: Buffer): "image/webp" | "image/jpeg" | null {
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  return null;
}

/** Upload: the browser resizes to about 256 px and sends the raw bytes (≤ 40 KB). */
export const POST = route(async (req) => {
  const user = await requireUser({ onboarded: false });
  await limitWindow("photo", String(user._id), 20, "hour", "Too many photo uploads. Try again later.");
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_PHOTO_BYTES) throw new ApiError(413, "That photo is too large. Try a different one.");
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length === 0) throw new ApiError(400, "No photo received.");
  if (buf.length > MAX_PHOTO_BYTES) throw new ApiError(413, "That photo is too large. Try a different one.");
  const mime = sniff(buf);
  if (!mime) throw new ApiError(415, "Please choose a JPEG, PNG or WebP photo.");
  const { photos, users } = await collections();
  const now = new Date();
  await photos.updateOne({ _id: user._id }, { $set: { mime, data: new Binary(buf), updatedAt: now } }, { upsert: true });
  const version = now.getTime();
  await users.updateOne({ _id: user._id }, { $set: { hasPhoto: true, photoVersion: version, updatedAt: now } });
  return json({ photoUrl: photoUrlFor({ _id: user._id, hasPhoto: true, photoVersion: version }) });
});

export const DELETE = route(async () => {
  const user = await requireUser({ onboarded: false });
  const { photos, users } = await collections();
  await Promise.all([photos.deleteOne({ _id: user._id }), users.updateOne({ _id: user._id }, { $set: { hasPhoto: false, updatedAt: new Date() } })]);
  return json({ photoUrl: null });
});
