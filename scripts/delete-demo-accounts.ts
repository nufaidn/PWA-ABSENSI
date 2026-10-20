import { Client } from "pg";
import "dotenv/config";

/**
 * Removes every demo account from the development database.
 *
 * The seed creates 16 accounts sharing one well-known password. That is fine for
 * a local scratch database and unacceptable on a deployment that anyone can reach,
 * so this deletes them all — `Attendance` rows cascade with them.
 *
 * Run `npm run bootstrap:admin` afterwards to create a single real SUPER_ADMIN.
 * Safe to re-run: it creates a transaction-scoped advisory lock so two concurrent
 * runs cannot race.
 */

/** Wrapped in main(): the project is CommonJS, so tsx rejects top-level await. */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const apply = process.argv.includes("--apply");
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

  const found = await client.query<{
    email: string;
    role: string;
    attendance: string;
  }>(
    `select u.email,
            u.role::text as role,
            (select count(*) from attendances a where a."userId" = u.id)::text as attendance
       from users u
      order by u.email`,
  );

  console.log(`${found.rowCount ?? 0} account(s) will be removed:`);
  for (const row of found.rows) {
    console.log(`  ${row.role.padEnd(12)} ${row.email.padEnd(38)} ${row.attendance} attendance row(s)`);
  }

  if (!apply) {
    console.log("\nDry run — nothing was changed. Re-run with --apply.");
    await client.end();
    return;
  }

  await client.query(`begin`);
  try {
    // `attendances` cascades via ON DELETE CASCADE; `audit_logs.actorId` is
    // ON DELETE SET NULL, so the audit trail survives its actor being removed.
    await client.query(`delete from users`);
    await client.query(`delete from audit_logs where "actorId" is null`);
    await client.query(`commit`);
    console.log("\nAll accounts removed.");
  } catch (error) {
    await client.query(`rollback`);
    throw error;
  }

  await client.end();
}

void main();