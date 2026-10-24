import { after } from "next/server";
import { z } from "zod";
import { requireUser, ApiError } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { collections } from "@/lib/db";
import { onboardingProblems, profileUpdateSchema } from "@/lib/schemas";
import { meDTO } from "@/lib/serialize";
import { onlyValidFields } from "@/lib/taxonomy";
import { matchProfile } from "@/lib/matching";
import { deleteUserCascade } from "@/lib/users";
import { getSettings } from "@/lib/settings";

export const maxDuration = 60;

export const GET = route(async () => {
  const user = await requireUser({ onboarded: false, approved: false });
  return json(meDTO(user, await getSettings()));
});

/** Profile fields that change who you're matched to. */
const MATCH_RELEVANT = ["fieldOfStudy", "skills", "tools", "experience", "lookingFor", "lookingForNote", "fields", "freeTags", "volunteering"] as const;

export const PATCH = route(async (req) => {
  const user = await requireUser({ onboarded: false });
  const patch = await readJson(req, profileUpdateSchema);
  const update: Record<string, unknown> = { ...patch, updatedAt: new Date() };
  if (patch.fields) update.fields = onlyValidFields(patch.fields);
  if (patch.links) update.links = Object.fromEntries(Object.entries(patch.links).filter(([, v]) => v));
  if (patch.volunteering && !patch.volunteering.open) update.volunteering = { open: false, for: null, areas: [], hoursPerMonth: null };
  if (patch.onboarded === true) {
    const merged = { ...user, ...update } as typeof user;
    const problems = onboardingProblems({ university: merged.university ?? "", city: merged.city ?? "", fieldOfStudy: merged.fieldOfStudy ?? "", skills: merged.skills ?? [], fields: (update.fields as string[]) ?? user.fields ?? [] });
    if (problems.length) throw new ApiError(400, problems[0]);
    if (!merged.contactEmail) update.contactEmail = user.email;
  }
  if (patch.onboarded === false) delete update.onboarded; // can't un-onboard
  const { users } = await collections();
  const updated = await users.findOneAndUpdate({ _id: user._id }, { $set: update }, { returnDocument: "after" });
  if (!updated) throw new ApiError(404, "Account not found.");

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
  return json(meDTO(updated, await getSettings()));
});

const deleteSchema = z.object({ confirm: z.literal("DELETE", { error: "Type DELETE to confirm" }) });

export const DELETE = route(async (req) => {
  const user = await requireUser({ onboarded: false, approved: false });
  if (user.isAdmin) throw new ApiError(400, "Admin accounts can't be deleted here. Remove the email from ADMIN_EMAILS first.");
  await readJson(req, deleteSchema);
  await deleteUserCascade(user._id);
  return json({ ok: true });
});
