import { requireUser, ApiError } from "@/lib/auth";
import { route, readJson, json, type IdCtx } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { connectionInputSchema } from "@/lib/schemas";
import { onlyValidFields } from "@/lib/taxonomy";

async function loadOwned(ctx: IdCtx) {
  const user = await requireUser();
  const { id } = await ctx.params;
  const oid = toObjectId(id);
  if (!oid) throw new ApiError(404, "Not found");
  const { connections } = await collections();
  const c = await connections.findOne({ _id: oid });
  if (!c) throw new ApiError(404, "Not found");
  if (String(c.addedBy) !== String(user._id) && !user.isAdmin) throw new ApiError(403, "Only the person who added this can change it.");
  return c;
}

export const PATCH = route(async (req, ctx: IdCtx) => {
  const c = await loadOwned(ctx);
  const body = await readJson(req, connectionInputSchema);
  const { connections } = await collections();
  await connections.updateOne(
    { _id: c._id },
    {
      $set: {
        name: body.name,
        role: body.role || null,
        organization: body.organization || null,
        location: body.location || null,
        fields: onlyValidFields(body.fields),
        linkedin: body.linkedin || null,
        contactPreference: body.contactPreference,
        note: body.note || null,
      },
    },
  );
  return json({ ok: true });
});

export const DELETE = route(async (_req, ctx: IdCtx) => {
  const c = await loadOwned(ctx);
  const { connections, introRequests } = await collections();
  await Promise.all([connections.deleteOne({ _id: c._id }), introRequests.deleteMany({ connectionId: c._id })]);
  return json({ ok: true });
});
