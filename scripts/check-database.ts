/**
 * Preflight check for the database connection.
 *
 * Run with `npm run db:check` before migrating. It answers the two questions
 * that are otherwise discovered by confusing errors:
 *
 *   1. Which database am I actually about to touch? (the host is printed — it
 *      is very easy to run a migration against local by accident)
 *   2. Is the schema already migrated?
 *
 * Exits non-zero when the connection fails, so it can gate a deploy step.
 */
// `.env` is not loaded automatically for plain `tsx` scripts — Prisma loads it
// via its own config, but this script runs outside that. `override: false`
// leaves anything already in the environment (CI, `dotenv -e`) authoritative.
import "dotenv/config";
import { Client } from "pg";

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env and set it.");
  process.exit(1);
}

// Re-narrowed to `string` for use inside `main`, which TypeScript cannot see
// through `process.exit` above.
const connectionString: string = url;

// Printed with the password removed. Never log the full string.
const parsed = new URL(url);
const safe =
  `postgresql://${parsed.username}@${parsed.hostname}:${parsed.port || 5432}${parsed.pathname}`;

console.log(`Target: ${safe}`);

const looksLocal = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
console.log(`Host:   ${looksLocal ? "LOCAL" : "REMOTE (hosted)"}`);

// Mirrors src/lib/realtime.ts so this script exercises the same TLS decision.
const ssl = process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false };

const client = new Client({ connectionString: url, ssl });

/**
 * Publishes on a throwaway channel and waits for a separate connection to
 * receive it. Verifies the capability the SSE stream actually depends on,
 * rather than trusting that LISTEN exists.
 */
async function probeListenNotify(
  connectionString: string,
  sslMode: object | false,
): Promise<string> {
  const channel = "attendance_events_check";
  const listener = new Client({ connectionString, ssl: sslMode as never });
  const publisher = new Client({ connectionString, ssl: sslMode as never });

  try {
    await listener.connect();
    await publisher.connect();
    await listener.query(`LISTEN ${channel}`);

    const got = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), 5000);
      listener.on("notification", (msg) => {
        if (msg.channel !== channel) return;
        clearTimeout(timer);
        resolve(msg.payload ?? "");
      });
    });

    await publisher.query("select pg_notify($1, $2)", [channel, "probe"]);
    await got;
    return "available";
  } catch (error) {
    return `unavailable (${error instanceof Error ? error.message : String(error)})`;
  } finally {
    await listener.end().catch(() => {});
    await publisher.end().catch(() => {});
  }
}

// Wrapped rather than using top-level await: the project is CommonJS, so `tsx`
// would reject it. See the seed script for the same pattern.
async function main(): Promise<void> {
  try {
    await client.connect();
    const version = await client.query("select version()");
  console.log(`\nConnected. ${version.rows[0].version.split(",")[0]}`);

  // Counts only the tables this app owns, ignoring anything else in the schema.
  const tables = await client.query<{ table_name: string }>(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_name in ($1, $2, $3, $4, $5, $6)`,
    ["users", "work_schedules", "attendances", "work_locations", "settings", "audit_logs"],
  );

  const found = tables.rowCount ?? 0;

  if (found === 0) {
    console.log("\nSchema: NOT migrated. Run `npm run db:deploy`.");
  } else if (found < 6) {
    console.log(`\nSchema: PARTIAL (${found}/6 tables). Re-run migrations.`);
  } else {
    console.log("\nSchema: migrated (6/6 tables).");

    const [users, attendance] = await Promise.all([
      client.query("select count(*)::int as n from users"),
      client.query("select count(*)::int as n from attendances"),
    ]);
    console.log(`users: ${users.rows[0].n}, attendances: ${attendance.rows[0].n}`);

    if (users.rows[0].n === 0) {
      console.log("No users yet. Run `npm run db:seed`.");
    }
  }

  // The realtime stream depends on LISTEN/NOTIFY working. `pg_notify` returns
  // void, so its value cannot be inspected — a real round-trip through a second
  // connection is the only honest probe.
  const realtime = await probeListenNotify(connectionString, ssl);
  console.log(`LISTEN/NOTIFY: ${realtime}`);
} catch (error) {
    console.error(`\nConnection failed: ${error instanceof Error ? error.message : String(error)}`);
    if (looksLocal) {
      console.error("Is the local PostgreSQL service running?");
    }
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

void main();