import "server-only";
import { COLLECTIONS, REALTIME_DOC_ID, firestore } from "@/lib/db";

/**
 * Realtime attendance notifications over a single Firestore document.
 *
 * The browser never talks to Firestore. A check-in writes a small "something
 * changed" document through the Admin SDK; each SSE connection polls that one
 * document and re-fetches through the normal authenticated Server Component
 * path. The payload carries no PII by construction: no name, no email, no
 * coordinates.
 *
 * The Admin SDK does not expose `onSnapshot`, so the server polls. At one read
 * per connection every 10 seconds this stays well inside the Firestore free
 * tier for a small organisation, and it avoids shipping a Firebase client key
 * and public security rules just to get a refresh signal.
 */

const POLL_MS = 10_000;

export interface AttendanceEvent {
  /** `check-in` | `check-out` | `admin` — which subsystem invalidated. */
  type: "check-in" | "check-out" | "admin";
  /** Server timestamp, used only to discard out-of-order or stale events. */
  at: string;
  /** Opaque version, so two events in the same millisecond are still distinct. */
  id?: string;
}

function isEventType(value: unknown): value is AttendanceEvent["type"] {
  return value === "check-in" || value === "check-out" || value === "admin";
}

/**
 * Announces that attendance data changed.
 *
 * Never throws. Realtime is a progressive enhancement: if the notification
 * fails the UI still works, it just needs a manual refresh. Letting a
 * notification failure abort a check-in would turn an optional feature into an
 * outage.
 */
export async function publishAttendanceEvent(
  type: AttendanceEvent["type"],
): Promise<void> {
  try {
    await firestore
      .collection(COLLECTIONS.realtime)
      .doc(REALTIME_DOC_ID)
      .set({
        type,
        at: new Date().toISOString(),
        id: crypto.randomUUID(),
      });
  } catch (error) {
    console.warn("[realtime] publish failed; UI will require a manual refresh", error);
  }
}

/**
 * Polls the signal document and invokes `onEvent` whenever its version changes.
 * Returns an async disposer; callers must invoke it when the SSE client leaves.
 */
export async function subscribeToAttendanceEvents(
  onEvent: (event: AttendanceEvent) => void,
  onError?: (error: unknown) => void,
): Promise<() => Promise<void>> {
  const ref = firestore.collection(COLLECTIONS.realtime).doc(REALTIME_DOC_ID);
  let closed = false;
  let lastId: string | null = null;
  let running = false;

  // Establish the current version without emitting: a client that just
  // connected should not immediately refresh because an old event is present.
  try {
    const snapshot = await ref.get();
    const data = snapshot.data();
    if (data && typeof data.id === "string") lastId = data.id;
  } catch (error) {
    onError?.(error);
  }

  const poll = async () => {
    if (closed || running) return;
    running = true;
    try {
      const snapshot = await ref.get();
      if (!snapshot.exists || closed) return;
      const data = snapshot.data();
      if (!data || !isEventType(data.type)) return;
      const id = typeof data.id === "string" ? data.id : null;
      if (id && id === lastId) return;
      lastId = id;
      onEvent({
        type: data.type,
        at: typeof data.at === "string" ? data.at : new Date().toISOString(),
        ...(id ? { id } : {}),
      });
    } catch (error) {
      onError?.(error);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    void poll();
  }, POLL_MS);

  return async () => {
    closed = true;
    clearInterval(timer);
  };
}

/**
 * Retained for callers that used to close a shared Postgres publisher. The
 * Firestore Admin SDK manages its own transport, so there is nothing to close.
 */
export async function closeAttendanceRealtime(): Promise<void> {
  // No-op.
}
