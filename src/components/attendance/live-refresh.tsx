"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Live refresh for admin dashboards.
 *
 * Subscribes to `/api/attendance/stream` and calls `router.refresh()` whenever
 * the server signals that attendance changed. `refresh()` re-runs the Server
 * Components on the current route, so the data still arrives through the
 * authorized DAL — the event itself carries no attendance content.
 *
 * `EventSource` reconnects automatically on its own, but only for transport-level
 * failures. A stream that closes cleanly (server restart, deploy) fires `error`
 * too, so the retry below handles both.
 */
export function useLiveAttendanceRefresh(enabled: boolean): "connecting" | "live" | "offline" {
  const router = useRouter();
  const [status, setStatus] = useState<"connecting" | "live" | "offline">("connecting");

  // Guards against a refresh storm: several check-ins in the same second would
  // otherwise queue one refresh per event.
  const lastRefresh = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Nothing to connect when disabled. The derived value below already reports
    // "offline", so no state update is needed here — calling setStatus in the
    // effect body would trigger a cascading render for a value we can compute.
    if (!enabled) return;

    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    let attempt = 0;

    const scheduleRefresh = () => {
      const now = Date.now();
      // Coalesce bursts into a single refresh.
      if (now - lastRefresh.current < 1000) {
        if (!pending.current) {
          pending.current = setTimeout(() => {
            pending.current = null;
            lastRefresh.current = Date.now();
            router.refresh();
          }, 1000);
        }
        return;
      }
      lastRefresh.current = now;
      router.refresh();
    };

    const connect = () => {
      if (disposed) return;
      source = new EventSource("/api/attendance/stream");

      source.addEventListener("open", () => {
        attempt = 0;
        setStatus("live");
      });

      source.addEventListener("attendance", scheduleRefresh);

      source.addEventListener("error", () => {
        if (disposed) return;
        setStatus("offline");
        source?.close();
        // Exponential backoff, capped, so a backend outage does not turn into a
        // reconnect storm against a rate-limited or down endpoint.
        attempt += 1;
        const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
        retry = setTimeout(connect, delay);
      });
    };

    connect();

    return () => {
      disposed = true;
      source?.close();
      if (retry) clearTimeout(retry);
      if (pending.current) clearTimeout(pending.current);
    };
  }, [enabled, router]);

  // `enabled` is a prop, so the disabled case is derived rather than stored.
  if (!enabled) return "offline";
  return status;
}