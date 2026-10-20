import { assertRole } from "@/lib/dal/auth";
import { subscribeToAttendanceEvents, type AttendanceEvent } from "@/lib/realtime";

/**
 * Server-Sent Events stream of attendance activity.
 *
 * Authorization is checked per connection using the app's own session cookie, so
 * this endpoint does not depend on Supabase's `anon` key and does not require
 * loosening RLS. The stream carries only opaque change signals — the browser
 * re-fetches the real data through Server Components that enforce authorization
 * on their own.
 *
 * `EventSource` cannot send credentials cross-origin, but same-origin requests
 * do carry the session cookie automatically, which is the deployment shape here
 * (Next.js serves both the app and this route).
 */

export const dynamic = "force-dynamic";
/** Streaming responses must not be statically optimised or buffered. */
export const runtime = "nodejs";

/**
 * Heartbeat interval.
 *
 * Proxies and load balancers close idle connections; a periodic comment frame
 * keeps the stream alive and lets the client notice a dead connection (which
 * triggers `EventSource`'s automatic reconnect) instead of hanging forever.
 */
const HEARTBEAT_MS = 25_000;

export async function GET(): Promise<Response> {
  try {
    // Admin-only: the signal is used to refresh the organisation-wide
    // dashboards. Employees have no view that needs a live feed.
    await assertRole("ADMIN");
  } catch {
    // Deliberately vague: a 401 here reveals nothing about which accounts exist.
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();

  // Shared between `start` and `cancel`, so the cleanup routine has to live
  // outside the underlying-source object literal.
  let dispose: (() => Promise<void>) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const cleanup = async () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    if (dispose) await dispose().catch(() => {});
    dispose = null;
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (chunk: string) => {
        if (closed) return true;
        try {
          controller.enqueue(encoder.encode(chunk));
          return true;
        } catch {
          // The stream was cancelled underneath us, i.e. the client left.
          void cleanup();
          return false;
        }
      };

      try {
        dispose = await subscribeToAttendanceEvents((event: AttendanceEvent) => {
          write(`event: attendance\ndata: ${JSON.stringify(event)}\n\n`);
        });

        // Tell the client the stream is live so it can stop showing "connecting".
        write(": connected\n\n");

        // Doubles as a liveness probe: if the client is gone, the next write
        // fails and tears the connection down instead of leaking it.
        heartbeat = setInterval(() => {
          write(": ping\n\n");
        }, HEARTBEAT_MS);
      } catch (error) {
        console.error("[realtime] subscribe failed", error);
        await cleanup();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },

    /**
     * Invoked by the runtime when the consumer cancels — which is how a browser
     * closing an `EventSource` surfaces here. Without it, every page navigation
     * would leave a LISTEN session open on the database.
     */
    async cancel() {
      await cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Nginx and some CDNs buffer streamed responses unless told not to.
      "X-Accel-Buffering": "no",
    },
  });
}