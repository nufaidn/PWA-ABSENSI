import "server-only";
import { Client } from "pg";

/**
 * Realtime attendance notifications over Postgres LISTEN/NOTIFY.
 *
 * Why not an in-memory event bus: on Vercel every Server Action and Route
 * Handler may run in a *different* serverless instance with its own heap, so a
 * module-level `EventEmitter` silently drops every event in production while
 * working perfectly in local dev. Routing the signal through Postgres means the
 * notification is seen by whichever instance holds the listener.
 *
 * Why not Supabase Realtime / Postgres Changes: those subscribe from the browser
 * with the `anon` key, which requires RLS policies that would expose attendance
 * rows to any client holding the publishable key. This keeps the existing
 * boundary intact — see `docs/architecture.md` §4 — because the browser only ever
 * receives an opaque "something changed" signal and re-fetches through the
 * normal authenticated Server Component path.
 *
 * The payload therefore carries no PII by construction: no name, no email, no
 * coordinates. A client reacts by calling `router.refresh()`, which re-renders
 * through the Server Components that already enforce authorization.
 */

const CHANNEL = "attendance_events";

/** Payload limit for a single NOTIFY is 8000 bytes; we use a fraction of it. */
export interface AttendanceEvent {
  /** `check-in` | `check-out` | `admin` — which subsystem invalidated. */
  type: "check-in" | "check-out" | "admin";
  /** Server timestamp, used only to discard out-of-order or stale events. */
  at: string;
}

declare global {
  var __attendanceRealtime: ReturnType<typeof connect> | undefined;
}

let publisher: Client | null = null;
let publisherReady: Promise<Client> | null = null;

function connect(): Client {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    // Supabase and most hosted providers terminate TLS; Prisma is configured for
    // this separately, but the raw pg client needs to be told explicitly.
    ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
  });

  // A pooled or idle connection can be dropped by the provider at any time. The
  // `error` handler keeps Node from treating that as an unhandled 'error' event,
  // which would crash the process; the next publish reconnects lazily.
  client.on("error", () => {
    publisherReady = null;
    publisher = null;
  });

  return client;
}

async function getPublisher(): Promise<Client> {
  if (publisher) return publisher;
  if (!publisherReady) {
    const client = connect();
    publisherReady = client
      .connect()
      .then(() => {
        publisher = client;
        globalThis.__attendanceRealtime = client;
        return client;
      })
      .catch((error: unknown) => {
        publisherReady = null;
        throw error;
      });
  }
  return publisherReady;
}

/**
 * Announces that attendance data changed.
 *
 * Never throws. Realtime is a progressive enhancement: if the notification fails
 * the UI still works, it just needs a manual refresh. Letting a notification
 * failure abort a check-in would turn an optional feature into an outage.
 */
export async function publishAttendanceEvent(
  type: AttendanceEvent["type"],
): Promise<void> {
  const payload: AttendanceEvent = { type, at: new Date().toISOString() };
  try {
    const client = await getPublisher();
    await client.query("SELECT pg_notify($1, $2)", [CHANNEL, JSON.stringify(payload)]);
  } catch (error) {
    console.warn("[realtime] publish failed; UI will require a manual refresh", error);
  }
}

/**
 * Subscribes to the channel and invokes `onEvent` for every notification.
 * Returns an unsubscribe function that also tears the connection down.
 *
 * Each SSE client needs its own LISTEN: Postgres notifications are delivered per
 * session, not per subscriber, so connections are not shareable between
 * requests. Callers must invoke the returned disposer on disconnect to avoid
 * leaking sessions back to the database.
 */
export async function subscribeToAttendanceEvents(
  onEvent: (event: AttendanceEvent) => void,
  onError?: (error: unknown) => void,
): Promise<() => Promise<void>> {
  const client = connect();
  await client.connect();

  // A notification larger than this, or one carrying an unexpected shape, is
  // ignored rather than passed to the client verbatim.
  client.on("notification", (message) => {
    if (message.channel !== CHANNEL || !message.payload) return;
    try {
      const parsed = JSON.parse(message.payload) as AttendanceEvent;
      if (parsed.type === "check-in" || parsed.type === "check-out" || parsed.type === "admin") {
        onEvent({ type: parsed.type, at: parsed.at ?? new Date().toISOString() });
      }
    } catch {
      // Malformed payload: nothing to do, and nothing worth surfacing.
    }
  });

  client.on("error", (error: unknown) => {
    onError?.(error);
  });

  await client.query(`LISTEN ${CHANNEL}`);

  return async () => {
    try {
      await client.query(`UNLISTEN ${CHANNEL}`);
    } catch {
      // Already gone; the close below is what matters.
    }
    await client.end().catch(() => {});
  };
}

/** Closes the shared publisher. Used by tests and graceful shutdown. */
export async function closeAttendanceRealtime(): Promise<void> {
  const client = publisher ?? globalThis.__attendanceRealtime;
  publisher = null;
  publisherReady = null;
  globalThis.__attendanceRealtime = undefined;
  if (client) await client.end().catch(() => {});
}