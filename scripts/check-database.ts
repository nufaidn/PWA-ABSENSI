/**
 * Preflight check for the Firestore connection.
 *
 * Run with `npm run db:check` before seeding or deploying. It answers the
 * questions that are otherwise discovered through confusing runtime errors:
 *
 *   1. Which Firebase project am I actually about to touch?
 *   2. Are the expected collections populated?
 *
 * Exits non-zero when the connection fails, so it can gate a deploy step.
 */
import "dotenv/config";
import { firestore } from "../src/lib/firebase-config";

const COLLECTIONS = [
  "users",
  "schedules",
  "attendance",
  "locations",
  "settings",
  "auditLogs",
] as const;

async function main(): Promise<void> {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? "(from credentials)";
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  console.log(`Project: ${projectId}`);
  console.log(`Target:  ${emulator ? `EMULATOR ${emulator}` : "Firestore (production)"}`);

  try {
    const counts = await Promise.all(
      COLLECTIONS.map(async (collection) => {
        const snapshot = await firestore.collection(collection).count().get();
        return [collection, snapshot.data().count] as const;
      }),
    );

    console.log("\nConnected.");
    for (const [collection, count] of counts) {
      console.log(`  ${collection.padEnd(12)} ${count}`);
    }

    const users = counts.find(([collection]) => collection === "users")?.[1] ?? 0;
    if (users === 0) {
      console.log("\nNo users yet. Run `npm run db:seed` for demo data or `npm run bootstrap:admin` for a real account.");
    }

    const realtime = await firestore.collection("realtime").doc("attendance").get();
    console.log(`\nRealtime signal: ${realtime.exists ? "present" : "not created yet"}`);
  } catch (error) {
    console.error(
      `\nConnection failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    console.error(
      "Check FIREBASE_PROJECT_ID and the service-account variables in .env, then try again.",
    );
    process.exitCode = 1;
  } finally {
    await firestore.terminate();
  }
}

void main();
