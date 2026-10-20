import { Client } from "pg";
import "dotenv/config";

/**
 * Cleans up leftovers in the development schema.
 *
 * Two kinds of damage can be left behind after a bad test run:
 *   - fixture users from the integration suite (`*@attendance.test`)
 *   - attendance rows whose `workDate` disagrees with the local check-in date,
 *     i.e. rows written through the old off-by-one code path
 *
 * Safe to re-run. Prints what it removed; deletes nothing without matching the
 * predicates below, so pointing this at a real database is not something to do
 * casually.
 */

/** Wrapped in main(): the project is CommonJS, so tsx rejects top-level await. */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const apply = process.argv.includes("--apply");
  const ssl = process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false };
  const client = new Client({ connectionString: url, ssl });
  await client.connect();

  // Refuse to run against anything but the development schema by accident.
  const schemaResult = await client.query<{ current_schema: string }>(
    "select current_schema()",
  );
  if (schemaResult.rows[0]?.current_schema !== "public") {
    console.log(`Connected to schema "${schemaResult.rows[0]?.current_schema}" (expected "public").`);
  }

  // Count first, then write. A dry run must never execute the destructive
  // statements at all — not even wrapped in EXPLAIN.
  const fixtureCount = await client.query<{ n: number }>(
    `select count(*)::int as n from users
      where email like '%@attendance.test' or id = 'schema-probe-id'`,
  );
  const shiftedCount = await client.query<{ n: number }>(
    `select count(*)::int as n from attendances
      where "checkInAt" is not null
        and "workDate" = ("checkInAt" at time zone 'UTC' at time zone 'Asia/Jakarta')::date - 1`,
  );

  const fixtures = fixtureCount.rows[0]?.n ?? 0;
  const shifted = shiftedCount.rows[0]?.n ?? 0;

  console.log(`${fixtures} fixture/probe user(s) in the development schema`);
  console.log(`${shifted} attendance row(s) stored one day behind their check-in date`);

  if (!apply) {
    console.log("\nDry run — nothing was changed. Re-run with --apply.");
  } else {
    await client.query(
      `delete from users where email like '%@attendance.test' or id = 'schema-probe-id'`,
    );
    // Only rows matching the exact off-by-one signature are touched.
    await client.query(
      `update attendances
          set "workDate" = ("checkInAt" at time zone 'UTC' at time zone 'Asia/Jakarta')::date
        where "checkInAt" is not null
          and "workDate" = ("checkInAt" at time zone 'UTC' at time zone 'Asia/Jakarta')::date - 1`,
    );
    console.log("\nApplied.");
  }

  await client.end();
}

void main();