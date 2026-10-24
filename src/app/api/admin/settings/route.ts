import { requireAdmin } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { DEFAULT_SETTINGS, getSettings, saveSettings, settingsSchema } from "@/lib/settings";
import { DEFAULT_PROMPTS } from "@/lib/prompts";

export const GET = route(async () => {
  await requireAdmin();
  return json({ settings: await getSettings(true), defaults: DEFAULT_SETTINGS, defaultPrompts: DEFAULT_PROMPTS });
});

export const PUT = route(async (req) => {
  const admin = await requireAdmin();
  const body = await readJson(req, settingsSchema);
  const saved = await saveSettings(body, admin.email);
  return json({ settings: saved });
});
