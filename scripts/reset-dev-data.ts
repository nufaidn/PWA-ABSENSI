import "dotenv/config";
import { firestore } from "../src/lib/firebase-config";
import { deleteCollections } from "./firestore-utils";

/**
 * Deletes every application document from Firestore.
 *
 * Only appropriate for a freshly seeded demo project. It exists because the
 * off-by-one `workDate` bug cannot be corrected in place: shifting rows forward
 * by a day collides with the `${userId}_${workDate}` document id, and the correct
 * end state is simply "what the fixed seed produces".
 *
 *   npm run db:reset            (dry run)
 *   npm run db:reset -- --apply
 */

const COLLECTIONS = [
  "attendance",
  "auditLogs",
  "users",
  "userEmails",
  "employeeCodes",
  "counters",
  "locations",
  "schedules",
  "settings",
  "realtime",
] as const;

async function main(): Promise<void> {
  if (!process.argv.includes("--apply")) {
    console.log("Dry run. Re-run with --apply to delete every application document.");
    return;
  }

  await deleteCollections(COLLECTIONS);
  console.log("\nCleared. Run `npm run db:seed` next.");
}

main()
  .catch((error) => {
    console.error("\nReset failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await firestore.terminate();
  });
