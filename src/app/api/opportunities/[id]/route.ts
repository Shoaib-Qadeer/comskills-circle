import { requireUser, ApiError } from "@/lib/auth";
import { route, readJson, json, type IdCtx } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";
import { opportunityPatchSchema } from "@/lib/schemas";
import { loadMiniUsers, opportunityDTO } from "@/lib/serialize";
import { onlyValidFields } from "@/lib/taxonomy";
import { normalizeUrl } from "@/lib/url";
import { matchOpportunity } from "@/lib/matching";

export const maxDuration = 60;

async function load(ctx: IdCtx) {
  const { id } = await ctx.params;
  const oid = toObjectId(id);
  if (!oid) throw new ApiError(404, "Not found");
  const { opportunities } = await collections();
  const opp = await opportunities.findOne({ _id: oid });
  if (!opp) throw new ApiError(404, "Not found");
  return opp;
}

export const GET = route(async (_req, ctx: IdCtx) => {
  const user = await requireUser();
  const opp = await load(ctx);
  const posters = await loadMiniUsers([opp.postedBy]);
  return json(opportunityDTO(opp, user, posters));
});

export const PATCH = route(async (req, ctx: IdCtx) => {
  const user = await requireUser();
  const opp = await load(ctx);
  if (String(opp.postedBy) !== String(user._id) && !user.isAdmin) throw new ApiError(403, "Only the poster can edit this.");
  const patch = await readJson(req, opportunityPatchSchema);
  const set: Record<string, unknown> = { ...patch, updatedAt: new Date() };
  if (patch.fields) set.fields = onlyValidFields(patch.fields);
  for (const k of ["deadline", "startDate"] as const) {
    if (k in patch) set[k] = patch[k] ? new Date(`${patch[k]!.slice(0, 10)}T00:00:00Z`) : null;
  }
  if (patch.url) {
    const key = normalizeUrl(patch.url);
    if (!key) throw new ApiError(400, "Invalid link");
    set.urlKey = key;
  }
  const { opportunities } = await collections();
  await opportunities.updateOne({ _id: opp._id }, { $set: set });
  const matchFields = ["title", "summary", "fields", "tags", "location", "remote", "frenchRequired", "type", "durationMonths", "eligibility"];
  if (matchFields.some((k) => k in patch)) await matchOpportunity(opp._id);
  const fresh = await opportunities.findOne({ _id: opp._id });
  const posters = await loadMiniUsers([fresh!.postedBy]);
  return json(opportunityDTO(fresh!, user, posters));
});

export const DELETE = route(async (_req, ctx: IdCtx) => {
  const user = await requireUser();
  const opp = await load(ctx);
  if (String(opp.postedBy) !== String(user._id) && !user.isAdmin) throw new ApiError(403, "Only the poster can delete this.");
  const { opportunities, matches } = await collections();
  await Promise.all([opportunities.deleteOne({ _id: opp._id }), matches.deleteMany({ opportunityId: opp._id })]);
  return json({ ok: true });
});
