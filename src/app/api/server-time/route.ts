import { NextResponse } from "next/server";

/**
 * Server clock.
 *
 * The client needs a trusted reference for two reasons: the UI must show the same
 * time that gets recorded, and a device with a wrong or drifting clock must not
 * be able to shift what the employee sees.
 *
 * The response carries only a timestamp — no attendance data and no personal
 * information — so it needs no authorization.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { now: Date.now() },
    {
      headers: {
        // A cached response would hand back the moment it was generated, which is
        // exactly the drift this endpoint exists to eliminate. The service worker
        // already treats `/api` as network-only; this header also covers the HTTP
        // cache and any intermediary.
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        Pragma: "no-cache",
      },
    },
  );
}