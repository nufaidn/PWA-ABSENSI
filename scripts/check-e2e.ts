/**
 * End-to-end check of the authenticated path against the *configured* database.
 *
 * Browsers cannot be driven here, so this mints a session cookie with the same
 * `jose` signing the app uses and replays it over HTTP. That proves the whole
 * chain — cookie accepted, user row re-read, DAL query executed on Supabase, and
 * the SSE stream authorized — rather than only checking that a port is open.
 *
 * Uses the app's own modules so a drift between this script and the app shows up
 * as a failure instead of passing silently.
 */
import { SignJWT } from "jose";
import "dotenv/config";
import { Client } from "pg";
import { readFileSync } from "node:fs";

/**
 * Duplicated from `src/lib/session.ts` rather than imported: that module begins
 * with `import "server-only"`, which deliberately throws outside a bundler. The
 * value is asserted against the real export below, so a rename cannot drift
 * silently.
 */
const SESSION_COOKIE_NAME = "uas_session";

const base = process.env.APP_URL ?? "http://localhost:3000";
const secret = process.env.AUTH_SECRET;
const dbUrl = process.env.DATABASE_URL;

// Reads the constant straight out of the source text. Keeps the duplicated value
// above honest without executing a module that is designed to throw here.
const sessionSource = readFileSync(
  new URL("../src/lib/session.ts", import.meta.url),
  "utf8",
);
const declared = /SESSION_COOKIE_NAME\s*=\s*"([^"]+)"/.exec(sessionSource)?.[1];
if (declared !== SESSION_COOKIE_NAME) {
  throw new Error(
    `Session cookie name drifted: this script has "${SESSION_COOKIE_NAME}", lib/session.ts has "${declared}".`,
  );
}

if (!secret) throw new Error("AUTH_SECRET not set");
if (!dbUrl) throw new Error("DATABASE_URL not set");

const ssl = process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false };

// Wrapped in `main()` because the project is CommonJS, so `tsx` rejects
// top-level await. Same constraint as scripts/check-database.ts.
async function main(): Promise<void> {
  const client = new Client({ connectionString: dbUrl, ssl });
  await client.connect();
  // Which account to sign in as. Defaults to the only one that should exist on a
  // real deployment; override with E2E_EMAIL for a seeded demo database.
  const email = process.env.E2E_EMAIL ?? "admin@gmail.com";
  const user = await client.query<{ id: string; email: string; role: string }>(
    "select id, email, role from users where email = $1",
    [email],
  );

  if (user.rowCount === 0) {
    const any = await client.query<{ email: string }>(
      "select email from users order by createdAt asc limit 1",
    );
    const hint = any.rows[0]
      ? `Found ${any.rows[0].email} instead — set E2E_EMAIL to that address.`
      : "The user table is empty. Run `npm run bootstrap:admin`.";
    console.error(`${email} not found. ${hint}`);
    process.exit(1);
  }
  const account = user.rows[0];
  console.log(`User: ${account.email} (${account.role})`);

  // Same payload and options as lib/session.ts.
  const token = await new SignJWT({ sid: crypto.randomUUID() })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(account.id)
    .setIssuedAt()
    .setIssuer("universal-attendance")
    .setAudience("universal-attendance-web")
    .setExpirationTime("3600s")
    .sign(new TextEncoder().encode(secret));

  const cookie = `${SESSION_COOKIE_NAME}=${token}`;

  async function check(label: string, path: string, expected: number): Promise<boolean> {
    const res = await fetch(`${base}${path}`, {
      headers: { cookie, accept: "text/html" },
      redirect: "manual",
    });
    const ok = res.status === expected;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}: ${res.status} (expected ${expected})`);
    return ok;
  }

  let allOk = true;

  allOk = (await check("admin overview", "/admin/overview", 200)) && allOk;
  allOk = (await check("reports", "/admin/reports", 200)) && allOk;
  allOk = (await check("employees", "/admin/employees", 200)) && allOk;
  allOk = (await check("settings", "/admin/settings", 200)) && allOk;
  allOk = (await check("dashboard", "/dashboard", 200)) && allOk;

  // `/admin` is the public sign-in page; signed in it must hand off to the
  // role-aware root rather than render a form that would immediately succeed.
  allOk = (await check("admin sign-in redirects when signed in", "/admin", 307)) && allOk;

  /*
   * The client clock depends on this endpoint. It has to be uncacheable and close
   * to this machine's clock, otherwise the dashboard drifts from real time.
   */
  console.log("\n--- server time ---");
  const timeSentAt = Date.now();
  const timeRes = await fetch(`${base}/api/server-time`, {
    headers: { cookie, accept: "application/json" },
  });
  const timeCacheControl = timeRes.headers.get("cache-control") ?? "";
  const serverNowMs = (await timeRes.json())?.now as number;
  const roundTrip = Date.now() - timeSentAt;
  const drift = Math.abs(serverNowMs + roundTrip / 2 - (timeSentAt + roundTrip));
  const timeOk =
    timeRes.status === 200 &&
    typeof serverNowMs === "number" &&
    Number.isFinite(serverNowMs) &&
    timeCacheControl.includes("no-store") &&
    drift < 5_000;
  console.log(`${timeOk ? "PASS" : "FAIL"}  server-time: ${timeRes.status} ${JSON.stringify({ serverNowMs, driftMs: Math.round(drift) })}`);
  console.log(`${timeCacheControl.includes("no-store") ? "PASS" : "FAIL"}  cache-control: ${timeCacheControl || "(missing)"}`);
  allOk = timeOk && allOk;

  // The SSE endpoint must now authorize and hold the stream open.
  console.log("\n--- realtime stream ---");
  const controller = new AbortController();
  const streamRes = await fetch(`${base}/api/attendance/stream`, {
    headers: { cookie, accept: "text/event-stream" },
    signal: controller.signal,
  });

  console.log(`status:   ${streamRes.status}`);
  console.log(`content-type: ${streamRes.headers.get("content-type")}`);

  if (streamRes.status === 200 && streamRes.body) {
    const reader = streamRes.body.getReader();
    const decoder = new TextDecoder();
    let seenConnected = false;

    // Read until the server's ": connected" comment frame arrives.
    while (!seenConnected) {
      const { value, done } = await reader.read();
      if (done) break;
      if (decoder.decode(value).includes(": connected")) seenConnected = true;
    }
    console.log(`connected frame: ${seenConnected ? "received" : "MISSING"}`);
    allOk = seenConnected && allOk;

    // Now publish a real event and confirm it arrives over the stream.
    const publisher = new Client({ connectionString: dbUrl, ssl });
    await publisher.connect();
    await publisher.query("select pg_notify($1, $2)", [
      "attendance_events",
      JSON.stringify({ type: "check-in", at: new Date().toISOString() }),
    ]);
    await publisher.end();

    let gotEvent = false;
    const deadline = Date.now() + 10_000;
    while (!gotEvent && Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      if (decoder.decode(value).includes("event: attendance")) gotEvent = true;
    }
    console.log(`attendance event: ${gotEvent ? "received" : "MISSING"}`);
    allOk = gotEvent && allOk;
  } else {
    console.log("FAIL  stream did not open");
    allOk = false;
  }

  controller.abort();
  await client.end().catch(() => {});

  console.log(`\n${allOk ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"}`);
  process.exitCode = allOk ? 0 : 1;
}

void main();