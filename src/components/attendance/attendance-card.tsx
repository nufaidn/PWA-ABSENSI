"use client";

import * as React from "react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Crosshair,
  Loader2,
  LogIn,
  LogOut,
  MapPinOff,
  Navigation,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { checkInAction, checkOutAction, type AttendanceActionState } from "@/app/actions/attendance";
import { StatusBadge } from "@/components/layout/badges";
import { formatDuration } from "@/lib/attendance/time";
import { STATUS_DESCRIPTOR } from "@/lib/attendance/time";
import { useServerClock } from "@/lib/attendance/use-server-clock";
import type { AttendanceStatus } from "@/lib/domain";

/**
 * The check-in / check-out control.
 *
 * Design notes:
 * - The action button is full width and at the bottom of the card on phones,
 *   within thumb reach, and stays a comfortable size on desktop.
 * - The displayed time always comes from the server payload, never from the
 *   device clock, so what the employee sees matches what was recorded.
 * - GPS is requested lazily on press and the action proceeds without it unless
 *   the organization enforces location validation.
 */

export interface AttendanceCardData {
  status: AttendanceStatus | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number;
  workedMinutes: number;
  distanceMeters: number | null;
  outsideRadius: boolean;
  /** Schedule bounds, used for the "before/after hours" hint. */
  startTime: string;
  endTime: string;
  lateToleranceMinutes: number;
  requireLocation: boolean;
  isWorkingDay: boolean;
  timezone: string;
  /** Server time at render, used as the drift reference for the live clock. */
  serverNow: string;
  serverTimezone: string;
}

type GeoState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "granted"; latitude: number; longitude: number; accuracy: number }
  | { status: "denied"; message: string }
  | { status: "unavailable"; message: string };

/** Reads coordinates, always reporting what happened so the UI can explain it. */
function requestGeolocation(): Promise<GeoState> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve({
        status: "unavailable",
        message: "Perangkat ini tidak mendukung pengambilan lokasi.",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          status: "granted",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (error) =>
        resolve({
          status: "denied",
          message:
            error.code === error.PERMISSION_DENIED
              ? "Izin lokasi ditolak. Anda tetap dapat absen tanpa lokasi."
              : "Lokasi tidak dapat ditentukan. Anda tetap dapat absen tanpa lokasi.",
        }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  });
}

export function AttendanceCard({ data }: { data: AttendanceCardData }) {
  const router = useRouter();
  const [geo, setGeo] = useState<GeoState>({ status: "idle" });
  const [toast, setToast] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const hasCheckedIn = Boolean(data.checkInAt);
  const hasCheckedOut = Boolean(data.checkOutAt);

  /*
   * Server-authoritative clock. The offset against the server is re-measured from
   * `/api/server-time` whenever the tab becomes visible again, so leaving the app
   * in the background for an hour no longer leaves the display an hour behind.
   */
  const liveNow = useServerClock(data.serverNow);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Geolocation is requested before the action is dispatched, so the button has to
  // cover that gap too — otherwise a second tap starts a second permission
  // request while the first is still resolving. `pending` alone does not, because
  // the action has not been dispatched yet.
  const [isLocating, setIsLocating] = useState(false);
  const [, startTransition] = useTransition();

  const [state, submitAction, pending] = useActionState(
    async (prev: AttendanceActionState, formData: FormData) => {
      const intent = formData.get("intent");
      const next =
        intent === "check-out"
          ? await checkOutAction(prev, formData)
          : await checkInAction(prev, formData);

      if (next.ok) {
        setToast({ tone: "ok", text: next.message ?? "Berhasil." });
        router.refresh();
      } else if (next.error) {
        setToast({ tone: "error", text: next.error });
      }
      return next;
    },
    {} as AttendanceActionState,
  );

  /**
   * Wraps the action so the browser permission prompt happens first and the
   * coordinates ride along in the same submission. The form still works when
   * geolocation is refused — it simply arrives without a location.
   *
   * `submitAction` is invoked inside `startTransition` rather than directly.
   * Passing this function as `action={...}` puts the *call to handleSubmit* in a
   * transition, but the `await` for geolocation ends that synchronous scope — so
   * calling the dispatch afterwards happened outside a transition, which React
   * reports as "called outside of a transition" and which leaves `pending`
   * stuck: the button would never return to its idle state.
   */
  async function handleSubmit(formData: FormData) {
    setIsLocating(true);
    try {
      const geoState = await requestGeolocation();
      setGeo(geoState);

      if (geoState.status === "granted") {
        formData.set(
          "payload",
          JSON.stringify({
            latitude: geoState.latitude,
            longitude: geoState.longitude,
            accuracy: geoState.accuracy,
          }),
        );
      }
    } finally {
      setIsLocating(false);
    }

    startTransition(() => {
      submitAction(formData);
    });
  }
  const liveClock = formatInZone(new Date(liveNow), data.serverTimezone);

  /*
   * The running total of an open shift, and the final duration of a closed one.
   * Both are the plain elapsed time between check-in and now, or check-in and
   * check-out, so the number does not shrink at check-out.
   */
  const elapsed =
    data.checkInAt && !data.checkOutAt
      ? Math.max(0, Math.floor((liveNow - new Date(data.checkInAt).getTime()) / 60_000))
      : data.workedMinutes;

  const statusDescriptor = data.status ? STATUS_DESCRIPTOR[data.status] : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-card surface-elevated">
        <div className="flex flex-col gap-1.5 border-b border-border px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              Waktu Server
            </p>
            {statusDescriptor && data.status ? (
              <StatusBadge
                label={statusDescriptor.label}
                className={statusDescriptor.className}
                dotClassName={statusDescriptor.dotClassName}
              />
            ) : (
              <span className="rounded-full bg-muted px-2.5 py-1 text-[12px] font-medium text-muted-foreground">
                Belum absen
              </span>
            )}
          </div>
          <p className="tabular text-[34px] font-semibold leading-none tracking-tight text-foreground">
            {liveClock}
          </p>
          <p className="text-[12px] text-muted-foreground">
            Jadwal {data.startTime}–{data.endTime}
            {data.lateToleranceMinutes > 0
              ? ` · toleransi ${data.lateToleranceMinutes} menit`
              : " · tanpa toleransi"}
          </p>
        </div>

        <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
          <div className="px-5 py-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Check-in
            </p>
            <p className="tabular mt-1.5 text-xl font-semibold text-foreground">
              {data.checkInAt ? formatInZone(new Date(data.checkInAt), data.serverTimezone) : "—"}
            </p>
            {data.checkInAt && data.lateMinutes > 0 ? (
              <p className="mt-1 text-[12px] font-medium text-[oklch(0.42_0.11_76)]">
                Terlambat {data.lateMinutes} menit
              </p>
            ) : null}
          </div>
          <div className="px-5 py-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Check-out
            </p>
            <p className="tabular mt-1.5 text-xl font-semibold text-foreground">
              {data.checkOutAt ? formatInZone(new Date(data.checkOutAt), data.serverTimezone) : "—"}
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {hasCheckedIn && !hasCheckedOut
                ? `Berjalan ${formatDuration(elapsed)}`
                : data.checkInAt && hasCheckedOut
                  ? `Durasi ${formatDuration(data.workedMinutes)}`
                  : "Durasi —"}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <GeoNotice geo={geo} requireLocation={data.requireLocation} distanceMeters={data.distanceMeters} outsideRadius={data.outsideRadius} />

          {toast ? (
            <div
              role="status"
              className={cn(
                "flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-[13px] leading-relaxed ring-1 ring-inset",
                toast.tone === "ok"
                  ? "bg-success-muted text-[oklch(0.34_0.08_163)] ring-success/25"
                  : "bg-destructive/10 text-destructive ring-destructive/25",
              )}
            >
              {toast.tone === "ok" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
              )}
              <span>{toast.text}</span>
            </div>
          ) : null}

          {state.error && !toast ? (
            <p role="alert" className="text-[13px] text-destructive">
              {state.error}
            </p>
          ) : null}

          {!data.isWorkingDay ? (
            <p className="rounded-lg bg-muted px-3.5 py-3 text-[13px] text-muted-foreground">
              Hari ini bukan hari kerja Anda. Anda tetap dapat absen bila diperbolehkan admin.
            </p>
          ) : null}

          <form action={handleSubmit} className="w-full">
            {hasCheckedIn && hasCheckedOut ? (
              <Button type="button" variant="secondary" size="lg" className="w-full" disabled>
                <CheckCircle2 className="size-4" />
                Absensi hari ini selesai
              </Button>
            ) : hasCheckedIn ? (
              <>
                <Button
                  type="submit"
                  size="lg"
                  variant="destructive"
                  className="w-full min-h-14 text-[15px] font-semibold"
                  disabled={pending || isLocating}
                >
                  {pending || isLocating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <LogOut className="size-4" />
                  )}
                  {isLocating
                    ? "Mengambil lokasi…"
                    : pending
                      ? "Memproses…"
                      : "Check-out Sekarang"}
                </Button>
                <input type="hidden" name="intent" value="check-out" />
              </>
            ) : (
              <>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full min-h-14 text-[15px] font-semibold"
                  disabled={pending || isLocating}
                >
                  {pending || isLocating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <LogIn className="size-4" />
                  )}
                  {isLocating
                    ? "Mengambil lokasi…"
                    : pending
                      ? "Memproses…"
                      : "Check-in Sekarang"}
                </Button>
                <input type="hidden" name="intent" value="check-in" />
              </>
            )}
          </form>

          <p className="text-center text-[11.5px] leading-relaxed text-muted-foreground">
            Waktu absensi dicatat dari server dan tidak dapat diubah dari perangkat ini.
          </p>
        </div>
      </div>
    </div>
  );
}

function GeoNotice({
  geo,
  requireLocation,
  distanceMeters,
  outsideRadius,
}: {
  geo: GeoState;
  requireLocation: boolean;
  distanceMeters: number | null;
  outsideRadius: boolean;
}) {
  if (geo.status === "locating") {
    return (
      <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Mengambil lokasi Anda…
      </p>
    );
  }

  if (geo.status === "denied" || geo.status === "unavailable") {
    return (
      <p
        className={cn(
          "flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-[12.5px] leading-relaxed",
          requireLocation
            ? "bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground",
        )}
      >
        <MapPinOff className="mt-0.5 size-3.5 shrink-0" />
        <span>
          {geo.message}
          {requireLocation ? " Lokasi wajib diaktifkan untuk absen." : ""}
        </span>
      </p>
    );
  }

  if (geo.status === "granted") {
    return (
      <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
        <Navigation className="size-3.5 shrink-0" />
        Lokasi terkunci
        {geo.accuracy > 0 ? ` ±${Math.round(geo.accuracy)} m` : ""}
        {distanceMeters !== null ? ` · ${Math.round(distanceMeters)} m dari titik absensi` : ""}
      </p>
    );
  }

  if (outsideRadius) {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-warning-muted px-3.5 py-2.5 text-[12.5px] text-[oklch(0.42_0.11_76)]">
        <Crosshair className="mt-0.5 size-3.5 shrink-0" />
        <span>Absensi tercatat di luar area yang ditentukan dan ditandai pada laporan.</span>
      </p>
    );
  }

  return null;
}

/**
 * Formats an instant as `HH:mm:ss` in the organization's timezone.
 *
 * The parts are assembled manually rather than by relying on the locale's
 * pattern: `id-ID` renders `09.00.00`, with dots instead of colons, so the raw
 * `Intl` output did not look like a clock.
 *
 * `Intl.DateTimeFormat` construction is also expensive (it builds an ICU object)
 * and this runs four times per render on a one-second tick, so formatters are
 * cached per timezone — there is only ever one organization timezone in practice.
 */
const zoneFormatters = new Map<string, Intl.DateTimeFormat>();

function getZoneFormatter(timezone: string): Intl.DateTimeFormat {
  const cached = zoneFormatters.get(timezone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  });
  zoneFormatters.set(timezone, formatter);
  return formatter;
}

function formatInZone(date: Date, timezone: string): string {
  const parts = getZoneFormatter(timezone).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "00";
  return `${part("hour")}:${part("minute")}:${part("second")}`;
}