import { requireUser } from "@/lib/auth";
import { route, readJson, json } from "@/lib/api";
import { collections } from "@/lib/db";
import { connectionInputSchema } from "@/lib/schemas";
import { connectionDTO, loadMiniUsers } from "@/lib/serialize";
import { onlyValidFields } from "@/lib/taxonomy";
import type { ConnectionDoc } from "@/lib/types";

export const GET = route(async (req) => {
  const user = await requireUser();
  const field = new URL(req.url).searchParams.get("field");
  const { connections } = await collections();
  const docs = await connections.find(field ? { fields: field } : {}).sort({ createdAt: -1 }).limit(500).toArray();
  const owners = await loadMiniUsers(docs.map((d) => d.addedBy));
  return json({ items: docs.map((d) => connectionDTO(d, user._id, owners)) });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson(req, connectionInputSchema);
  const doc: Omit<ConnectionDoc, "_id"> = {
    name: body.name,
    role: body.role || null,
    organization: body.organization || null,
    location: body.location || null,
    fields: onlyValidFields(body.fields),
    linkedin: body.linkedin || null,
    contactPreference: body.contactPreference,
    note: body.note || null,
    addedBy: user._id,
    createdAt: new Date(),
  };
  const { connections } = await collections();
  const { insertedId } = await connections.insertOne(doc as ConnectionDoc);
  return json({ id: String(insertedId) }, { status: 201 });
});
