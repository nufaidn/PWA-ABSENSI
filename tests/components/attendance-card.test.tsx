import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { AttendanceCard, type AttendanceCardData } from "@/components/attendance/attendance-card";
import type { AttendanceActionState } from "@/app/actions/attendance";

/**
 * Regression test for the check-in / check-out submit path.
 *
 * `attendance-card.tsx` requests geolocation *before* dispatching its
 * `useActionState` action. Passing that wrapper straight to `<form action={...}>`
 * looked correct, but the `await` ends React's synchronous transition scope, so
 * the dispatch ran outside a transition: React logged "called outside of a
 * transition" and `pending` never cleared, leaving the button stuck on
 * "Memproses…".
 *
 * Nothing in the build or type system catches that, so it is asserted here.
 */

const checkInAction = vi.fn<(prev: AttendanceActionState, formData: FormData) => Promise<AttendanceActionState>>();
const checkOutAction = vi.fn<(prev: AttendanceActionState, formData: FormData) => Promise<AttendanceActionState>>();

vi.mock("@/app/actions/attendance", () => ({
  checkInAction: (prev: AttendanceActionState, formData: FormData) => checkInAction(prev, formData),
  checkOutAction: (prev: AttendanceActionState, formData: FormData) => checkOutAction(prev, formData),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const DATA: AttendanceCardData = {
  status: null,
  checkInAt: null,
  checkOutAt: null,
  lateMinutes: 0,
  workedMinutes: 0,
  distanceMeters: null,
  outsideRadius: false,
  startTime: "09:00",
  endTime: "18:00",
  lateToleranceMinutes: 10,
  requireLocation: false,
  isWorkingDay: true,
  timezone: "Asia/Jakarta",
  serverNow: "2026-10-13T02:00:00.000Z",
  serverTimezone: "Asia/Jakarta",
};

/** Resolves the geolocation callback on the next tick, like a real browser. */
function stubGeolocation(): { granted: boolean } {
  const state = { granted: true };
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (onSuccess: (position: unknown) => void) => {
        setTimeout(() => {
          if (state.granted) {
            onSuccess({ coords: { latitude: -6.2, longitude: 106.8, accuracy: 12 } });
          }
        }, 0);
      },
    },
  });
  return state;
}

let consoleErrors: unknown[][];
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  checkInAction.mockReset();
  checkOutAction.mockReset();
  checkInAction.mockResolvedValue({ ok: true, message: "Check-in berhasil." });
  checkOutAction.mockResolvedValue({ ok: true, message: "Check-out berhasil." });

  stubGeolocation();

  consoleErrors = [];
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    consoleErrors.push(args);
  });
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  vi.useRealTimers();
});

/** Any React warning about transitions or actions. */
function transitionWarnings(): string[] {
  return consoleErrors
    .map((args) => args.map(String).join(" "))
    .filter((text) => /transition|useActionState|action/i.test(text));
}

describe("attendance card submission", () => {
  it("does not warn when the action is dispatched after an await", async () => {
    render(<AttendanceCard data={DATA} />);

    screen.getByRole("button", { name: /check-in/i }).click();

    await waitFor(() => expect(checkInAction).toHaveBeenCalledTimes(1));

    // React reports the bug as a console.error at submit time, never at build.
    expect(transitionWarnings()).toEqual([]);
  });

  it("sends the coordinates gathered after the await", async () => {
    render(<AttendanceCard data={DATA} />);

    screen.getByRole("button", { name: /check-in/i }).click();

    await waitFor(() => expect(checkInAction).toHaveBeenCalledTimes(1));

    const formData = checkInAction.mock.calls[0]?.[1];
    const payload = JSON.parse(String(formData?.get("payload")));
    expect(payload.latitude).toBeCloseTo(-6.2);
    expect(payload.longitude).toBeCloseTo(106.8);
    expect(formData?.get("intent")).toBe("check-in");
  });

  it("still submits when location permission is refused", async () => {
    const geo = stubGeolocation();
    geo.granted = false;
    // Swap in a resolver that rejects, which is what a denied permission does.
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (
          _onSuccess: unknown,
          onError: (error: { code: number; PERMISSION_DENIED: number }) => void,
        ) => {
          setTimeout(() => onError({ code: 1, PERMISSION_DENIED: 1 }), 0);
        },
      },
    });

    render(<AttendanceCard data={DATA} />);
    screen.getByRole("button", { name: /check-in/i }).click();

    await waitFor(() => expect(checkInAction).toHaveBeenCalledTimes(1));

    const formData = checkInAction.mock.calls[0]?.[1];
    // No payload means "location unavailable", which the server records rather
    // than rejecting — unless the organization enforces location validation.
    expect(formData?.get("payload")).toBeNull();
    expect(transitionWarnings()).toEqual([]);
  });

  it("returns the button to an idle state once the action settles", async () => {
    render(<AttendanceCard data={DATA} />);

    screen.getByRole("button", { name: /check-in/i }).click();

    // `pending` stuck on true was the user-visible half of this bug.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /check-in sekarang/i })).toBeEnabled();
    });
    expect(transitionWarnings()).toEqual([]);
  });
});
/**
 * Regression tests for the live clock.
 *
 * The clock used to advance by a fixed 1000 ms per interval callback, so it only
 * moved as fast as the timer actually fired. Browsers throttle and skip overdue
 * callbacks in hidden tabs, and on sleep/wake every missed callback was a
 * permanent one-second loss: after leaving the app open in the background the
 * display stayed an hour behind and only a refresh corrected it.
 *
 * It now measures a `serverOffset` against `/api/server-time` and recomputes the
 * display from `Date.now() + offset` on every tick, re-measuring whenever the tab
 * becomes visible again.
 */
describe("attendance card live clock", () => {
  /** What the stubbed server believes the time is. */
  let serverNowMs: number;
  let fetchCalls: RequestInit[];

  /** Stubs `/api/server-time`, recording the cache mode of every request. */
  function stubServerClock() {
    fetchCalls = [];
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push(init ?? {});
      return new Response(JSON.stringify({ now: serverNowMs }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;
  }

  /** The `HH:mm:ss` value rendered under the "Waktu Server" label. */
  function renderedClock(): string {
    return document.querySelectorAll("p.tabular")[0]?.textContent ?? "";
  }

/** Lets the offset resync settle, and flushes the deferred first paint. */
  async function settle() {
    act(() => {
      vi.advanceTimersByTime(1);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    serverNowMs = new Date("2026-10-13T02:00:00.000Z").getTime();
    // The device agrees with the server to start with.
    vi.setSystemTime(new Date(serverNowMs));
    stubServerClock();
  });

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Pretends the document is hidden or visible. */
  function setVisibility(state: "hidden" | "visible") {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue(state);
  }

  it("shows the server time in the organization timezone", async () => {
    render(<AttendanceCard data={DATA} />);
    await settle();

    // Colons, not the `09.00.00` that the `id-ID` pattern would produce.
    expect(renderedClock()).toBe("09:00:00");
    expect(fetchCalls[0]?.cache).toBe("no-store");
  });

  it("keeps real time when the app is left in the background", async () => {
    render(<AttendanceCard data={DATA} />);
    await settle();

    // An hour passes with the app minimized: the browser stops firing callbacks,
    // and the device clock moves with real time.
    serverNowMs += 60 * 60_000;
    vi.setSystemTime(new Date(serverNowMs));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await settle();

    expect(renderedClock()).toBe("10:00:00");
  });

  it("keeps real time when interval callbacks are dropped", async () => {
    render(<AttendanceCard data={DATA} />);
    await settle();

    /*
     * An hour passes with not a single callback firing: `setSystemTime` moves the
     * mocked clock without running any timer. The single tick that follows then has
     * to jump the whole hour, because the display is derived from the wall clock
     * rather than accumulated one second at a time.
     */
    vi.setSystemTime(new Date(serverNowMs + 60 * 60_000));
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(renderedClock()).toBe("10:00:00");
  });

  it("follows the server when the device clock is wrong", async () => {
    // The device is an hour slow the moment the app opens.
    vi.setSystemTime(new Date(serverNowMs - 60 * 60_000));
    render(<AttendanceCard data={DATA} />);
    await settle();

    expect(renderedClock()).toBe("09:00:00");

    // Half an hour later the user fixes the device clock by hand, overshooting it.
    serverNowMs += 30 * 60_000;
    vi.setSystemTime(new Date(serverNowMs + 60_000));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await settle();

    // Still server time, not the device's.
    expect(renderedClock()).toBe("09:30:00");
  });

  it("re-measures the offset on a bfcache restore", async () => {
    render(<AttendanceCard data={DATA} />);
    await settle();

    // The page comes back from the back/forward cache with a skewed device clock.
    vi.setSystemTime(new Date(serverNowMs - 5 * 60_000));
    serverNowMs += 60 * 60_000;
    act(() => {
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    await settle();

    expect(renderedClock()).toBe("10:00:00");
  });

  it("stops ticking while hidden and resumes when visible again", async () => {
    setVisibility("hidden");
    render(<AttendanceCard data={DATA} />);
    await settle();

    vi.setSystemTime(new Date(serverNowMs + 20_000));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // Hidden: the display is frozen and no tick timer is kept running.
    expect(renderedClock()).toBe("09:00:00");

    setVisibility("visible");
    serverNowMs += 60_000;
    vi.setSystemTime(new Date(serverNowMs));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await settle();

    expect(renderedClock()).toBe("09:01:00");
  });

  it("cleans up every timer and listener on unmount", async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const { unmount } = render(<AttendanceCard data={DATA} />);
    await settle();

    const removeSpy = vi.spyOn(document, "removeEventListener");
    const windowRemoveSpy = vi.spyOn(window, "removeEventListener");
    unmount();

    const removed = [
      ...removeSpy.mock.calls.map((call) => call[0]),
      ...windowRemoveSpy.mock.calls.map((call) => call[0]),
    ];
    expect(removed).toContain("visibilitychange");
    expect(removed).toContain("focus");
    expect(removed).toContain("pageshow");
    expect(clearIntervalSpy).toHaveBeenCalled();

    // No listener survives the unmount: a late event must not update a gone card.
    serverNowMs += 60 * 60_000;
    expect(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    }).not.toThrow();
  });
});
