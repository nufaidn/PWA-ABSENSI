import { Client } from "pg";
import "dotenv/config";

/**
 * Removes the seeded demo schedules and geo-fence locations.
 *
 * Those rows carry fictional office coordinates. The intent is for the
 * administrator to define their own real locations, and a plausible-looking fake
 * one is worse than none: it silently accepts check-ins in the wrong place.
 *
 * Touches only `work_schedules` and `work_locations`. Accounts, attendance and
 * the settings row are left alone.
 *
 *   npm run db:purge-reference          (dry run)
 *   npm run db:purge-reference -- --apply
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

  // A schedule still assigned to an employee cannot be deleted — the foreign key
  // is ON DELETE RESTRICT. Report that rather than letting the delete fail later.
  const schedules = await client.query<{ id: string; name: string; in_use: number; is_default: boolean }>(
    `select s.id, s.name, s."isOrganizationDefault" as is_default,
            (select count(*) from users u where u."scheduleId" = s.id)::int as in_use
       from work_schedules s
      order by s.name`,
  );
  const locations = await client.query<{ id: string; name: string; lat: number; lng: number; radius: number }>(
    `select id, name, latitude as lat, longitude as lng, "radiusMeters" as radius
       from work_locations order by name`,
  );

  console.log(`SCHEDULES (${schedules.rowCount}):`);
  for (const s of schedules.rows) {
    console.log(`  ${s.name}${s.is_default ? " [default organisasi]" : ""}${s.in_use > 0 ? ` — dipakai ${s.in_use} karyawan` : ""}`);
  }
  console.log(`\nLOCATIONS (${locations.rowCount}):`);
  for (const l of locations.rows) {
    console.log(`  ${l.name}  ${l.lat}, ${l.lng}  r=${l.radius}m`);
  }

  const blocked = schedules.rows.filter((s) => s.in_use > 0);
  if (blocked.length > 0) {
    console.log(
      `\nRefusing: ${blocked.length} schedule(s) are still assigned to an employee. Detach them first.`,
    );
    await client.end();
    process.exitCode = 1;
    return;
  }

  if (!apply) {
    console.log("\nDry run — nothing was changed. Re-run with --apply.");
    await client.end();
    return;
  }

  await client.query("begin");
  try {
    // `Setting.defaultScheduleId` is ON DELETE SET NULL, but clearing it first
    // keeps the "organisation default schedule" dropdown honest either way.
    await client.query(`update settings set "defaultScheduleId" = null where "defaultScheduleId" is not null`);
    await client.query(`delete from work_locations`);
    await client.query(`delete from work_schedules`);
    await client.query("commit");
    console.log("\nRemoved. Admin can now create their own schedules and locations.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  await client.end();
}

void main();