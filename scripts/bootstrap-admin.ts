import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { firestore } from "../src/lib/firebase-config";

/**
 * Creates the first ADMIN account a fresh deployment needs.
 *
 * Replaces the demo seed for anything reachable by other people. There is no
 * "first run" signup in the app by design — the role gate in `lib/dal/auth.ts`
 * decides who may create employees, and an unauthenticated endpoint that mints an
 * admin would be a hole in exactly that gate. So the first admin is created here,
 * once, deliberately.
 *
 *   npm run bootstrap:admin                       (generates a password)
 *   npm run bootstrap:admin -- admin@company.com   (with a chosen email)
 *
 * Refuses to run if an account already exists, so it cannot silently replace a
 * working login or be re-run on a live database.
 */

const COLLECTIONS = {
  users: "users",
  settings: "settings",
  userEmails: "userEmails",
} as const;

const SETTINGS_DOC_ID = "organization";

/** Wrapped in main(): the project is CommonJS, so tsx rejects top-level await. */
async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => a !== "--apply");
  const email = (args[0] ?? process.env.BOOTSTRAP_ADMIN_EMAIL ?? "admin@company.test").toLowerCase();

  // Supplied through the environment or a generated value so the password does
  // not end up in shell history or in a file committed by accident.
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? randomPassword();

  const existing = await firestore.collection(COLLECTIONS.users).limit(1).get();
  if (!existing.empty) {
    console.log(
      `Refusing to run: ${existing.size} account(s) already exist. Delete them first if you really mean to reset.`,
    );
    process.exitCode = 1;
    return;
  }

  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();

  const batch = firestore.batch();
  batch.set(firestore.collection(COLLECTIONS.users).doc(id), {
    email,
    passwordHash,
    name: "Administrator",
    employeeCode: null,
    role: "ADMIN",
    department: null,
    phone: null,
    isActive: true,
    scheduleId: null,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(firestore.collection(COLLECTIONS.userEmails).doc(email), { userId: id });
  // The settings document is a singleton the app expects to exist; `getSettings()`
  // would create it lazily, but writing it now keeps the deployment deterministic.
  batch.set(
    firestore.collection(COLLECTIONS.settings).doc(SETTINGS_DOC_ID),
    {
      organizationName: process.env.BOOTSTRAP_ORG_NAME ?? "Perusahaan Saya",
      timezone: "Asia/Jakarta",
      defaultScheduleId: null,
      requireLocationValidation: false,
      updatedAt: now,
    },
    { merge: true },
  );
  await batch.commit();

  console.log(`ADMIN created: ${email}`);
  console.log(`Password: ${password}`);
  console.log("\nSign in, then change this password immediately (Profil → Ganti password).");
}

/** 20 characters from an unambiguous alphabet — no I/l/O/0/1 to misread. */
function randomPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(20);
  let out = "";
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}

void main();
