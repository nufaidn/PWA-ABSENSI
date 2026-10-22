import "dotenv/config";
import { firestore } from "../src/lib/firebase-config";
import { WEEKDAY_INDEXES, describeWorkingDays } from "../src/lib/attendance/time";

/**
 * Writes the working days onto schedules that predate the field.
 *
 * Schedules used to assume Monday–Friday globally. The days now live on the
 * schedule itself, so every existing document needs the value spelled out —
 * otherwise the application would keep guessing, and an admin editing the
 * schedule would silently change which days it applies to.
 *
 * The mapper already falls back to Monday–Friday, so this script is about
 * making the stored data explicit rather than about fixing a failure.
 *
 *   npm run db:backfill-working-days          (dry run)
 *   npm run db:backfill-working-days -- --apply
 */

const COLLECTIONS = { schedules: "schedules" } as const;

function isDayList(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (day) => typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6,
    )
  );
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  const snapshot = await firestore.collection(COLLECTIONS.schedules).get();

  const updates: Array<{ id: string; name: string; workingDays: number[] }> = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (isDayList(data.workingDays)) continue;
    updates.push({
      id: doc.id,
      name: typeof data.name === "string" ? data.name : doc.id,
      workingDays: [...WEEKDAY_INDEXES],
    });
  }

  if (updates.length === 0) {
    console.log("Semua jadwal sudah punya hari kerja. Tidak ada yang perlu diubah.");
    return;
  }

  console.log(`Jadwal yang perlu diperbarui (${updates.length}):`);
  for (const update of updates) {
    console.log(
      `  ${update.name} -> ${describeWorkingDays(update.workingDays)} (${update.workingDays.join(", ")})`,
    );
  }

  if (!apply) {
    console.log("\nDry run. Jalankan ulang dengan `-- --apply` untuk menulis ke Firestore.");
    return;
  }

  const batch = firestore.batch();
  const now = new Date();
  for (const update of updates) {
    batch.update(firestore.collection(COLLECTIONS.schedules).doc(update.id), {
      workingDays: update.workingDays,
      updatedAt: now,
    });
  }
  await batch.commit();

  console.log(`\n${updates.length} jadwal diperbarui.`);
}

void main()
  .then(async () => {
    await firestore.terminate();
  })
  .catch(async (error) => {
    console.error("Gagal:", error instanceof Error ? error.message : error);
    await firestore.terminate();
    process.exitCode = 1;
  });
