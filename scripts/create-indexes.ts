// Run once after creating the database (optional — the app also creates indexes on first sign-in).
//   MONGODB_URI=... npm run db:indexes
import { ensureIndexes, getDb } from "../src/lib/db";

async function main() {
  await ensureIndexes();
  const db = await getDb();
  console.log(`Indexes ensured on database "${db.databaseName}".`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
