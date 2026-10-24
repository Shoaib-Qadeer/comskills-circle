import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { collections, toObjectId } from "@/lib/db";

type Ctx = { params: Promise<{ userId: string }> };

/**
 * Serves a profile photo. Only signed-in, approved members can fetch photos of listed members
 * (anyone can fetch their own, e.g. on the waiting page). Versioned URLs are cached for a year.
 */
export async function GET(req: Request, ctx: Ctx) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse(null, { status: 401 });
  const { userId } = await ctx.params;
  const oid = toObjectId(userId);
  if (!oid) return new NextResponse(null, { status: 404 });
  const self = String(oid) === String(viewer._id);
  if (!self && viewer.status !== "approved") return new NextResponse(null, { status: 403 });
  const { users, photos } = await collections();
  if (!self && !viewer.isAdmin) {
    const owner = await users.findOne({ _id: oid, status: "approved", emailVerifiedAt: { $ne: null } }, { projection: { _id: 1 } });
    if (!owner) return new NextResponse(null, { status: 404 });
  }
  const photo = await photos.findOne({ _id: oid });
  if (!photo) return new NextResponse(null, { status: 404 });
  const etag = `"p${photo.updatedAt.getTime()}"`;
  const versioned = new URL(req.url).searchParams.has("v");
  const headers = {
    "content-type": photo.mime,
    etag,
    "cache-control": versioned ? "private, max-age=31536000, immutable" : "private, no-cache",
    "x-content-type-options": "nosniff",
  };
  if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers });
  return new NextResponse(Buffer.from(photo.data.buffer), { status: 200, headers });
}
