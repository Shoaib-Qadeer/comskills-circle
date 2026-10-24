// Adds the curated starter opportunities (src/lib/starter-opportunities.ts) to the database and
// matches each one to classmates. Safe to run more than once: existing items are skipped.
//
//   MONGODB_URI=... MONGODB_DB=compass npm run db:starter
//
// LLM_* variables are optional here; without them, matching uses the basic rule-based matcher.
// You can do the same thing without installing anything from Admin → Content → "Add starter opportunities".
import { collections, ensureIndexes, getDb } from "../src/lib/db";
import { STARTER_OPPORTUNITIES } from "../src/lib/starter-opportunities";
import { importStarter } from "../src/lib/starter-import";

async function main() {
  const db = await getDb();
  await ensureIndexes();
  const { users } = await collections();
  const adminEmail = (process.env.ADMIN_EMAILS || "shoaib.qadeer@learningplanetinstitute.org").split(",")[0].trim().toLowerCase();
  const admin = await users.findOne({ email: adminEmail }, { projection: { _id: 1 } });
  console.log(`Adding ${STARTER_OPPORTUNITIES.length} starter opportunities to "${db.databaseName}"…`);
  let added = 0;
  for (const s of STARTER_OPPORTUNITIES) {
    const r = await importStarter(s.id, admin?._id ?? null);
    if (r.status === "imported") added++;
    console.log(`${r.status === "imported" ? "+" : "="} [${s.domain}] ${s.title}${r.matchCount != null ? ` (matched ${r.matchCount})` : ""}`);
  }
  console.log(`Done: ${added} added, ${STARTER_OPPORTUNITIES.length - added} already there.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
