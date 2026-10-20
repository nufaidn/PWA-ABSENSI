import { Client } from "pg";
import bcrypt from "bcryptjs";
import "dotenv/config";
import { randomBytes } from "node:crypto";

/**
 * Creates the single SUPER_ADMIN account a fresh deployment needs.
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

/** Wrapped in main(): the project is CommonJS, so tsx rejects top-level await. */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const args = process.argv.slice(2).filter((a) => a !== "--apply");
  const email = (args[0] ?? process.env.BOOTSTRAP_ADMIN_EMAIL ?? "admin@company.test").toLowerCase();

  // Supplied through the environment or stdin-free argument so the password does
  // not end up in shell history or in a file committed by accident.
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? randomPassword();

  const ssl = process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false };
  const client = new Client({ connectionString: url, ssl });
  await client.connect();

  const schemaResult = await client.query<{ current_schema: string }>("select current_schema()");
  if (schemaResult.rows[0]?.current_schema !== "public") {
    console.log(
      `Connected to schema "${schemaResult.rows[0]?.current_schema}" (expected "public"). Refusing.`,
    );
    await client.end();
    process.exitCode = 1;
    return;
  }

  const existing = await client.query<{ n: number }>("select count(*)::int as n from users");
  if ((existing.rows[0]?.n ?? 0) > 0) {
    console.log(
      `Refusing to run: ${existing.rows[0]?.n} account(s) already exist. Delete them first if you really mean to reset.`,
    );
    await client.end();
    process.exitCode = 1;
    return;
  }

  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();

  await client.query(
    `insert into users (id, email, "passwordHash", name, role, "isActive", "createdAt", "updatedAt")
     values ($1, $2, $3, $4, 'SUPER_ADMIN', true, $5, $5)`,
    [id, email, passwordHash, "Administrator", now],
  );

  // The settings row is a singleton the app expects to exist; `getSettings()`
  // would create it lazily, but writing it now keeps the deployment deterministic.
  await client.query(
    `insert into settings (id, "organizationName", timezone, "requireLocationValidation", "allowOutOfHoursCheckIn", "updatedAt")
     values (1, $1, 'Asia/Jakarta', false, true, $2)
     on conflict (id) do nothing`,
    [process.env.BOOTSTRAP_ORG_NAME ?? "Perusahaan Saya", now],
  );

  await client.end();

  console.log(`SUPER_ADMIN created: ${email}`);
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