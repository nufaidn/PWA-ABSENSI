"use client";

import * as React from "react";

/**
 * A clock that follows the server, not the device.
 *
 * The previous implementation advanced by a fixed 1000 ms per interval callback.
 * That couples the displayed time to how often the browser happened to fire the
 * timer: hidden tabs are throttled and overdue callbacks are skipped, and on
 * sleep/wake every missed callback is a permanent one-second loss. The clock
 * therefore fell behind and never caught up, and only a remount (or a refresh)
 * corrected it.
 *
 * This hook never counts ticks. It keeps a single `serverOffset` — the distance
 * between the server clock and the device clock — and recomputes the displayed
 * instant from `Date.now() + serverOffset` on each tick, so a dropped callback, a
 * suspended tab and device sleep all cost nothing. The offset is re-measured from
 * `/api/server-time` on mount, whenever the tab becomes visible again, on `focus`,
 * on a bfcache `pageshow`, and every few minutes.
 *
 * Display only. The timestamps written to the database are always read from the
 * server inside the DAL, never from anything this hook produces.
 */

const SERVER_TIME_URL = "/api/server-time";
/** Re-measure the offset periodically so a long-lived tab cannot drift away. */
const RESYNC_INTERVAL_MS = 5 * 60_000;
const TICK_INTERVAL_MS = 1000;

export function useServerClock(initialServerNow: string): number {
  /**
   * The first painted frame is the server time the page was rendered with, taken
   * straight from the prop. Reading the device clock during render would both
   * flash the wrong time on a skewed device and be an impure render.
   */
  const [now, setNow] = React.useState(() => new Date(initialServerNow).getTime());

  /** `serverTime - deviceTime`, in milliseconds. */
  const offsetRef = React.useRef(0);
  const mountedRef = React.useRef(true);

  const readNow = React.useCallback(() => Date.now() + offsetRef.current, []);

  const resync = React.useCallback(async () => {
    const sentAt = Date.now();
    try {
      const response = await fetch(SERVER_TIME_URL, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return;

      const payload: unknown = await response.json();
      const serverNow =
        typeof payload === "object" && payload !== null && "now" in payload
          ? (payload as { now?: unknown }).now
          : undefined;
      if (typeof serverNow !== "number" || !Number.isFinite(serverNow)) return;

      /*
       * The server timestamp was produced somewhere between `sentAt` and the
       * moment the response was read. Assuming a symmetric round trip, the
       * midpoint is the best estimate of when it was generated, so aligning
       * against the midpoint cancels the one-way latency instead of adding it.
       */
      const midpoint = sentAt + (Date.now() - sentAt) / 2;
      offsetRef.current = serverNow - midpoint;

      if (mountedRef.current) setNow(readNow());
    } catch {
      /*
       * Offline, or the request failed. The previous offset is kept: the clock
       * keeps running on the device's elapsed time and the next successful
       * resync corrects it, so a momentary failure is not visible.
       */
    }
  }, [readNow]);

  /*
   * Establish the baseline from the render's server time, so the very first tick
   * is already right even before the round trip finishes. The offset is not
   * *shown* through state here — the displayed value is only recomputed in the
   * deferred task below, which keeps a prop change from cascading a render.
   */
  React.useEffect(() => {
    offsetRef.current = new Date(initialServerNow).getTime() - Date.now();

    const timer = setTimeout(() => setNow(readNow()), 0);
    return () => clearTimeout(timer);
  }, [initialServerNow, readNow]);

  React.useEffect(() => {
    mountedRef.current = true;

    let tickTimer: ReturnType<typeof setInterval> | null = null;

    // While the tab is hidden the clock is not on screen, so the timer is stopped
    // entirely rather than left to be throttled. It is restarted on return.
    const stopTicking = () => {
      if (tickTimer === null) return;
      clearInterval(tickTimer);
      tickTimer = null;
    };

    const startTicking = () => {
      stopTicking();
      tickTimer = setInterval(() => setNow(readNow()), TICK_INTERVAL_MS);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        stopTicking();
        return;
      }
      startTicking();
      void resync();
    };

    const onFocus = () => {
      void resync();
    };

    /*
     * A bfcache restore resumes the page from a snapshot: timers created before
     * the freeze are not restarted, so the display would sit on the pre-freeze
     * value until something else re-rendered it.
     */
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      startTicking();
      void resync();
    };

    if (document.visibilityState === "visible") startTicking();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    const resyncTimer = setInterval(() => void resync(), RESYNC_INTERVAL_MS);
    // Deferred by a task: the first paint already uses the server time from the
    // render, so this only tightens the offset once the response is back.
    const kickoff = setTimeout(() => void resync(), 0);

    return () => {
      mountedRef.current = false;
      stopTicking();
      clearInterval(resyncTimer);
      clearTimeout(kickoff);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [readNow, resync]);

  return now;
}