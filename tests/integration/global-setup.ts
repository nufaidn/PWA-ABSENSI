import { execFileSync } from "node:child_process";
import { Client } from "pg";
// Loaded before anything reads DATABASE_URL: the global setup runs outside the
// Vite pipeline, so nothing else will have populated the environment.
import "dotenv/config";
import {
  baseDatabaseUrl,
  prismaTestDatabaseUrl,
  resetSql,
  sslFor,
  testDatabaseUrl,
  TEST_SCHEMA,
} from "./env";

/**
 * Global setup: builds the throwaway test schema once per run, and afterwards
 * proves the development schema was never touched.
 *
 * Uses `prisma migrate deploy` rather than replaying the SQL by hand, so the
 * tests run against exactly the migrations that would be deployed — including
 * any future ones, which is the whole point of testing here.
 */

/** Row counts in `public`, recorded before and after the run. */
let publicCountsBefore: Record<string, number> = {};

async function countPublic(client: Client): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const table of ["users", "work_schedules", "attendances", "work_locations", "settings"]) {
    const rows = await client.query<{ n: number }>(`select count(*)::int as n from public."${table}"`);
    result[table] = rows.rows[0]?.n ?? 0;
  }
  return result;
}

export async function setup(): Promise<void> {
  const url = testDatabaseUrl();

  // Hard stop: this suite runs TRUNCATE. If anything ever points it at `public` —
  // through a missed mock, a changed helper, a copied connection string — it would
  // silently destroy the developer's real attendance data. That is not
  // hypothetical: the first version of this suite did exactly that.
  //
  // Compared after parsing rather than by substring: the `options` parameter is
  // percent-encoded, so `search_path=attendance_test` never appears literally.
  const options = new URL(url).searchParams.get("options") ?? "";
  if (!options.includes(`search_path=${TEST_SCHEMA}`)) {
    throw new Error(
      `Refusing to run: test URL does not pin search_path=${TEST_SCHEMA} (got options=${options || "none"})`,
    );
  }

  // Drop and recreate on a *plain* connection. The test URL's `search_path` points
  // at a schema that may not exist yet, and Prisma fails to migrate into a
  // schema it cannot resolve.
  const admin = new Client({ connectionString: baseDatabaseUrl(), ssl: sslFor() });
  await admin.connect();

  publicCountsBefore = await countPublic(admin);
  await admin.query(resetSql());
  await admin.end();

  // `prisma migrate deploy` is the source of truth for the schema — the tests
  // must run against exactly the migrations that would be deployed. The CLI needs
  // `?schema=` where the runtime client needs `search_path`, so it gets its own URL.
  try {
    execFileSync("npx prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: prismaTestDatabaseUrl() },
      stdio: "pipe",
      shell: true,
    });
  } catch (error) {
    // execFileSync's default error hides the CLI output behind a buffer dump.
    const stderr = (error as { stderr?: Buffer }).stderr?.toString() ?? "";
    throw new Error(`prisma migrate deploy failed against ${TEST_SCHEMA}:\n${stderr.trim()}`);
  }
}

export async function teardown(): Promise<void> {
  const admin = new Client({ connectionString: baseDatabaseUrl(), ssl: sslFor() });
  await admin.connect();

  // Last line of defence. A schema bug that slips past every mock should still not
  // be able to destroy development data without the run saying so loudly.
  const after = await countPublic(admin);
  const changed = Object.entries(publicCountsBefore).filter(
    ([table, before]) => after[table] !== before,
  );
  if (changed.length > 0) {
    console.error(
      `\nWARNING: the integration suite modified the PUBLIC schema:\n${changed
        .map(([table, before]) => `  ${table}: ${before} -> ${after[table]}`)
        .join("\n")}\n\nThe test schema is leaking into the development database.\n`,
    );
  }

  await admin.query(resetSql());
  await admin.end();
}