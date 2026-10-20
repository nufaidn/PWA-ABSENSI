/**
 * Integration-test environment.
 *
 * The suite runs against a separate PostgreSQL *schema* in the same database,
 * never the `public` schema the dev server uses. That matters: these tests
 * truncate tables, so sharing a schema would destroy the developer's demo data on
 * every run.
 *
 * Only `auth` is mocked (see tests/integration/setup.ts). The DAL itself — the
 * transactions, the `(userId, workDate)` unique constraint, the status
 * derivation — runs for real, because those are exactly the guarantees that only
 * a database can prove.
 */

/** Schema used by the integration suite. Never `public`. */
export const TEST_SCHEMA = "attendance_test";

export function baseDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Neither TEST_DATABASE_URL nor DATABASE_URL is set. Integration tests need a database.",
    );
  }
  return url;
}

/**
 * The connection used by both the Prisma client and raw SQL in the suite.
 *
 * Two independent mechanisms have to be pointed at the test schema, and neither
 * implies the other. Both were verified against a live database, and getting
 * either one wrong leaks the run into the development schema:
 *
 *  - `?schema=` tells *Prisma* which schema to qualify its generated table names
 *    with. Omit it and Prisma silently defaults to `public`, so every write lands
 *    in the development tables even while the pool is correctly pointed away.
 *  - `options=-c search_path=` sets the *pool's* `search_path`, which is what
 *    unqualified SQL (`resetDatabase`'s TRUNCATE, `current_schema()`) resolves
 *    against. The adapter's own `schema` option does not do this — under Prisma 7's
 *    driver adapter it only affects generated queries.
 *
 * There is deliberately no `sslmode`: adding one makes `pg-connection-string`
 * upgrade it to `verify-full`, which rejects Supabase's self-signed chain. TLS is
 * decided in code by `sslFor` instead.
 */
export function testDatabaseUrl(): string {
  const url = new URL(baseDatabaseUrl());
  url.searchParams.set("schema", TEST_SCHEMA);
  url.searchParams.set("options", `-c search_path=${TEST_SCHEMA}`);
  return url.toString();
}

/** The same target, as the Prisma CLI resolves it (`?schema=` only). */
export function prismaTestDatabaseUrl(): string {
  const url = new URL(baseDatabaseUrl());
  url.searchParams.set("schema", TEST_SCHEMA);
  return url.toString();
}

/**
 * TLS options matching the application's own rule: hosted providers get TLS with
 * certificate verification relaxed (Supabase presents a self-signed chain), while
 * local development can opt out with `DATABASE_SSL=disable`.
 */
export function sslFor(): false | { rejectUnauthorized: boolean } {
  return process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false };
}

/** Drops and recreates the schema so each run starts from a known state. */
export function resetSql(): string {
  return `drop schema if exists ${TEST_SCHEMA} cascade; create schema ${TEST_SCHEMA};`;
}