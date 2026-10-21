import "dotenv/config";
import { firestore } from "../src/lib/firebase-config";

/**
 * Removes the seeded demo schedules and geo-fence locations.
 *
 * Those documents carry fictional office coordinates. The intent is for the
 * administrator to define their own real locations, and a plausible-looking fake
 * one is worse than none: it silently accepts check-ins in the wrong place.
 *
 * Touches only `schedules` and `locations`. Accounts, attendance and the settings
 * document are left alone.
 *
 *   npm run db:purge-reference          (dry run)
 *   npm run db:purge-reference -- --apply
 */

const COLLECTIONS = {
  schedules: "schedules",
  locations: "locations",
  users: "users",
  settings: "settings",
} as const;

const SETTINGS_DOC_ID = "organization";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  const [schedules, locations, users] = await Promise.all([
    firestore.collection(COLLECTIONS.schedules).get(),
    firestore.collection(COLLECTIONS.locations).get(),
    firestore.collection(COLLECTIONS.users).get(),
  ]);

  const usage = new Map<string, number>();
  for (const doc of users.docs) {
    const scheduleId = doc.data().scheduleId;
    if (typeof scheduleId === "string") {
      usage.set(scheduleId, (usage.get(scheduleId) ?? 0) + 1);
    }
  }

  console.log(`SCHEDULES (${schedules.size}):`);
  for (const doc of schedules.docs) {
    const data = doc.data();
    const inUse = usage.get(doc.id) ?? 0;
    console.log(
      `  ${data.name}${data.isOrganizationDefault ? " [default organisasi]" : ""}${
        inUse > 0 ? ` — dipakai ${inUse} karyawan` : ""
      }`,
    );
  }

  console.log(`\nLOCATIONS (${locations.size}):`);
  for (const doc of locations.docs) {
    const data = doc.data();
    console.log(`  ${data.name}  ${data.latitude}, ${data.longitude}  r=${data.radiusMeters}m`);
  }

  const blocked = schedules.docs.filter((doc) => (usage.get(doc.id) ?? 0) > 0);
  if (blocked.length > 0) {
    console.log(
      `\nRefusing: ${blocked.length} schedule(s) are still assigned to an employee. Detach them first.`,
    );
    process.exitCode = 1;
    return;
  }

  if (!apply) {
    console.log("\nDry run — nothing was changed. Re-run with --apply.");
    return;
  }

  await firestore.collection(COLLECTIONS.settings).doc(SETTINGS_DOC_ID).set(
    { defaultScheduleId: null, updatedAt: new Date() },
    { merge: true },
  );

  for (let offset = 0; offset < locations.size; offset += 400) {
    const batch = firestore.batch();
    for (const doc of locations.docs.slice(offset, offset + 400)) batch.delete(doc.ref);
    await batch.commit();
  }
  for (let offset = 0; offset < schedules.size; offset += 400) {
    const batch = firestore.batch();
    for (const doc of schedules.docs.slice(offset, offset + 400)) batch.delete(doc.ref);
    await batch.commit();
  }

  console.log("\nRemoved. Admin can now create their own schedules and locations.");
}

main()
  .catch((error) => {
    console.error("\nPurge failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await firestore.terminate();
  });
