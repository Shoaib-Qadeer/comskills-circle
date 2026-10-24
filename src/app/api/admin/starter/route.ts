import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { importStarter, starterStatus } from "@/lib/starter-import";

export const maxDuration = 60;

export const GET = route(async () => {
  await requireAdmin();
  return json({ items: await starterStatus() });
});

/** Imports one item per request so each stays well inside serverless time limits; the dashboard loops with a progress bar. */
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const { id } = await readJson(req, z.object({ id: z.string() }));
  return json(await importStarter(id, admin._id));
});
