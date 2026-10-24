import { after } from "next/server";
import { requireUser, ApiError } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { collections } from "@/lib/db";
import { profileUpdateSchema } from "@/lib/schemas";
import { meDTO } from "@/lib/serialize";
import { onlyValidFields } from "@/lib/taxonomy";
import { matchProfile } from "@/lib/matching";
import { deleteUserCascade } from "@/lib/users";
import { z } from "zod";

export const maxDuration = 60;

export const GET = route(async () => {
  const user = await requireUser({ onboarded: false, approved: false });
  return json(meDTO(user));
});

const MATCH_RELEVANT = ["headline", "summary", "fields", "freeTags", "targetRoles", "preferredLocations", "openToFrench"] as const;

export const PATCH = route(async (req) => {
  const user = await requireUser({ onboarded: false });
  const patch = await readJson(req, profileUpdateSchema);
  const update: Record<string, unknown> = { ...patch, updatedAt: new Date() };
  if (patch.fields) update.fields = onlyValidFields(patch.fields);
  if (patch.links) update.links = Object.fromEntries(Object.entries(patch.links).filter(([, v]) => v));
  if (patch.onboarded === true) {
    const fields = (update.fields as string[] | undefined) ?? user.fields;
    if (!fields.length) throw new ApiError(400, "Pick at least one field so we can match you.");
  }
  if (patch.onboarded === false) delete update.onboarded; // can't un-onboard
  const { users } = await collections();
  const updated = await users.findOneAndUpdate({ _id: user._id }, { $set: update }, { returnDocument: "after" });
  if (!updated) throw new ApiError(404, "User not found");
  updated.isAdmin = user.isAdmin;

  // Re-match in the background after edits that change who you are matched to.
  const changed = MATCH_RELEVANT.some((k) => k in patch);
  if (updated.onboarded && user.onboarded && changed) {
    after(async () => {
      try {
        await matchProfile(user._id);
      } catch (e) {
        console.error("[rematch after edit]", e);
      }
    });
  }
  return json(meDTO(updated));
});

const deleteSchema = z.object({ confirm: z.literal("DELETE") });

export const DELETE = route(async (req) => {
  const user = await requireUser({ onboarded: false, approved: false });
  await readJson(req, deleteSchema);
  await deleteUserCascade(user._id);
  return json({ ok: true });
});
