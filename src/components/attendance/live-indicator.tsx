"use client";

import { useLiveAttendanceRefresh } from "@/components/attendance/live-refresh";

/**
 * Mounts the attendance event stream for a live dashboard.
 *
 * A separate Client Component because the page itself must stay a Server
 * Component — passing the `live` flag down as a prop from the page would mean
 * threading a client-only concern through the server render.
 *
 * Shows a small indicator so a stalled connection is visible rather than silent;
 * otherwise a dashboard could sit on stale numbers with nothing to explain why.
 */
export function LiveAttendanceIndicator({ enabled }: { enabled: boolean }) {
  const status = useLiveAttendanceRefresh(enabled);
  if (!enabled || status === "live") return null;

  return (
    <span className="text-[11.5px] text-muted-foreground" role="status">
      {status === "connecting" ? "Menghubungkan ke data langsung…" : "Koneksi langsung terputus."}
    </span>
  );
}