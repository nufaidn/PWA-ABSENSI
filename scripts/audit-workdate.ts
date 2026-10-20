import { Client } from "pg";
import "dotenv/config";

/** Wrapped in main(): the project is CommonJS, so tsx rejects top-level await. */
async function main(): Promise<void> {
  const ssl = process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false };
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl });
  await client.connect();

  const before = await client.query(
    `select min("workDate")::text as lo, max("workDate")::text as hi, count(*)::int as n
       from "attendances"`,
  );
  console.log("before:", before.rows[0]);

  // A row stores the UTC date part of the instant it was handed. Rows written
  // through the buggy path carry the previous day's date, exactly one day behind
  // `checkInAt`'s local calendar date.
  //
  // Note the double conversion. `checkInAt` is `timestamp WITHOUT time zone`
  // (no `@db.Timestamptz` on the column) holding UTC wall-clock values, which is
  // Prisma's convention. A single `at time zone 'Asia/Jakarta'` would *relabel*
  // those UTC digits as Jakarta local time without shifting them, producing
  // false mismatches for any early-morning check-in.
  const shifted = await client.query<{ id: string; workdate: string; localdate: string }>(
    `select a.id,
            to_char(a."workDate", 'YYYY-MM-DD') as workdate,
            to_char((a."checkInAt" at time zone 'UTC' at time zone 'Asia/Jakarta')::date, 'YYYY-MM-DD') as localdate
       from "attendances" a
      where a."checkInAt" is not null
        and to_char(a."workDate", 'YYYY-MM-DD')
            <> to_char((a."checkInAt" at time zone 'UTC' at time zone 'Asia/Jakarta')::date, 'YYYY-MM-DD')
      limit 5`,
  );

  console.log(`rows needing a +1 day shift: ${shifted.rowCount ?? 0}`);
  if ((shifted.rowCount ?? 0) > 0) {
    console.log("sample:", shifted.rows.slice(0, 3));
  } else {
    console.log("no rows need correcting");
  }

  await client.end();
}

void main();