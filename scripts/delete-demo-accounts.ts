import "dotenv/config";
import { firestore } from "../src/lib/firebase-config";

/**
 * Removes every demo account from Firestore.
 *
 * The seed creates accounts sharing one well-known password. That is fine for a
 * local scratch database and unacceptable on a deployment that anyone can reach,
 * so this deletes them all, including their attendance rows and uniqueness
 * documents.
 *
 * Run `npm run bootstrap:admin` afterwards to create a single real SUPER_ADMIN.
 * Safe to re-run: it is idempotent.
 *
 *   npm run db:purge-demo            (dry run)
 *   npm run db:purge-demo -- --apply
 */

const COLLECTIONS = {
  users: "users",
  attendance: "attendance",
  auditLogs: "auditLogs",
  userEmails: "userEmails",
  employeeCodes: "employeeCodes",
} as const;

async function deleteByField(collection: string, field: string, value: string): Promise<number> {
  let deleted = 0;
  for (;;) {
    const snapshot = await firestore.collection(collection).where(field, "==", value).limit(400).get();
    if (snapshot.empty) break;
    const batch = firestore.batch();
    for (const doc of snapshot.docs) batch.delete(doc.ref);
    await batch.commit();
    deleted += snapshot.size;
  }
  return deleted;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const snapshot = await firestore.collection(COLLECTIONS.users).get();
  const demoUsers = snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as { email?: string; role?: string }) }))
    .filter((user) => (user.email ?? "").toLowerCase().endsWith("@demo.test"));

  console.log(`${demoUsers.length} demo account(s) found:`);
  for (const user of demoUsers) {
    const attendance = await firestore
      .collection(COLLECTIONS.attendance)
      .where("userId", "==", user.id)
      .count()
      .get();
    console.log(
      `  ${String(user.role ?? "").padEnd(12)} ${String(user.email ?? "").padEnd(38)} ${attendance.data().count} attendance row(s)`,
    );
  }

  if (demoUsers.length === 0) {
    console.log("\nNothing to do.");
    return;
  }

  if (!apply) {
    console.log("\nDry run — nothing was changed. Re-run with --apply.");
    return;
  }

  for (const user of demoUsers) {
    const attendance = await deleteByField(COLLECTIONS.attendance, "userId", user.id);
    const audit = await deleteByField(COLLECTIONS.auditLogs, "actorId", user.id);
    const batch = firestore.batch();
    batch.delete(firestore.collection(COLLECTIONS.users).doc(user.id));
    if (user.email) {
      batch.delete(firestore.collection(COLLECTIONS.userEmails).doc(user.email.toLowerCase()));
    }
    await batch.commit();
    console.log(
      `  removed ${user.email ?? user.id}: ${attendance} attendance, ${audit} audit entries`,
    );
  }

  // Employee-code uniqueness documents may still point at deleted users.
  const codes = await firestore.collection(COLLECTIONS.employeeCodes).get();
  const demoIds = new Set(demoUsers.map((user) => user.id));
  const staleCodes = codes.docs.filter((doc) => demoIds.has(String(doc.data().userId)));
  if (staleCodes.length > 0) {
    const batch = firestore.batch();
    for (const doc of staleCodes) batch.delete(doc.ref);
    await batch.commit();
    console.log(`  removed ${staleCodes.length} employee-code document(s)`);
  }

  console.log("\nAll demo accounts removed.");
}

main()
  .catch((error) => {
    console.error("\nPurge failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await firestore.terminate();
  });
