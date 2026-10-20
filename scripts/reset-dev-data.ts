import { Client } from "pg";
import "dotenv/config";

/**
 * Truncates every application table in the development schema.
 *
 * Only appropriate for a freshly seeded demo database. It exists because the
 * off-by-one `workDate` bug cannot be corrected in place: shifting rows forward
 * by a day collides with the `(userId, workDate)` unique constraint, and the
 * correct end state is simply "what the fixed seed produces".
 */

/** Wrapped in main(): the project is CommonJS, so tsx rejects top-level await. */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  if (!process.argv.includes("--apply")) {
    console.log("Dry run. Re-run with --apply to truncate.");
    return;
  }

  const ssl = process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false };
  const client = new Client({ connectionString: url, ssl });
  await client.connect();

  const result = await client.query<{ current_schema: string }>("select current_schema()");
  const schema = result.rows[0]?.current_schema;
  if (schema !== "public") {
    console.log(`Connected to schema "${schema}". Refusing to truncate a non-public schema.`);
    await client.end();
    process.exitCode = 1;
    return;
  }

  await client.query(
    `truncate table "attendances", "audit_logs", "users", "work_locations", "work_schedules", "settings" restart identity cascade`,
  );
  console.log("Truncated. Run `npm run db:seed` next.");
  await client.end();
}

void main();