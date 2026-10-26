"use client";

import * as React from "react";
import Link from "next/link";
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
  Clock,
  AlertTriangle,
  Lock,
  Info,
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
  /** Free-form note from the schedule, e.g. "Khusus Sabtu jam kerja 08:00-14:00". */
  scheduleNote: string | null;
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
      {/* Main Clock Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card to-card/50 shadow-lg backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative flex flex-col gap-2 border-b border-border/50 px-6 py-6">
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
              <span className="rounded-full bg-muted/60 px-3 py-1.5 text-[12px] font-medium text-muted-foreground backdrop-blur-sm">
                Belum absen
              </span>
            )}
          </div>
          <p className="tabular text-5xl font-black leading-none tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-foreground/70">
            {liveClock}
          </p>
          <div className="mt-2 space-y-1.5">
            <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Clock className="size-4" />
              <span>
                Jadwal <span className="font-semibold text-foreground">{data.startTime}–{data.endTime}</span>
                {data.lateToleranceMinutes > 0
                  ? ` · toleransi ${data.lateToleranceMinutes} menit`
                  : " · tanpa toleransi"}
              </span>
            </p>
            {data.scheduleNote ? (
              <p className="flex items-start gap-2 text-[12px] italic leading-relaxed text-muted-foreground bg-muted/30 rounded px-2.5 py-1.5">
                <Info className="size-4 shrink-0 mt-0.5" />
                <span>{data.scheduleNote}</span>
              </p>
            ) : null}
          </div>
        </div>

        {/* Check-in/Check-out Stats */}
        <div className="grid grid-cols-2 divide-x divide-border/50 border-b border-border/50 bg-muted/20">
          <div className="px-6 py-5">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Check-in
              </p>
              <CheckCircle2 className="size-4" />
            </div>
            <p className="tabular mt-2 text-2xl font-bold text-foreground">
              {data.checkInAt ? formatInZone(new Date(data.checkInAt), data.serverTimezone) : "—"}
            </p>
            {data.checkInAt && data.lateMinutes > 0 ? (
              <p className="mt-1.5 flex items-center gap-2 text-[12px] font-semibold text-[oklch(0.42_0.11_76)]">
                <AlertTriangle className="size-4" />
                Terlambat {data.lateMinutes} menit
              </p>
            ) : null}
          </div>
          <div className="px-6 py-5">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Check-out
              </p>
              <LogOut className="size-4" />
            </div>
            <p className="tabular mt-2 text-2xl font-bold text-foreground">
              {data.checkOutAt ? formatInZone(new Date(data.checkOutAt), data.serverTimezone) : "—"}
            </p>
            <p className="mt-1.5 flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
              {hasCheckedIn && !hasCheckedOut
                ? <>
                    <Clock className="size-4" />
                    {formatDuration(elapsed)}
                  </>
                : data.checkInAt && hasCheckedOut
                  ? <>
                      <CheckCircle2 className="size-4 text-green-600" />
                      {formatDuration(data.workedMinutes)}
                    </>
                  : "—"}
            </p>
          </div>
        </div>

        {/* Action Area */}
        <div className="relative flex flex-col gap-4 px-6 py-6">
          <GeoNotice geo={geo} requireLocation={data.requireLocation} distanceMeters={data.distanceMeters} outsideRadius={data.outsideRadius} />

          {toast ? (
            <div
              role="status"
              className={cn(
                "flex items-start gap-3 rounded-lg px-4 py-3.5 text-[13px] leading-relaxed font-medium ring-1 ring-inset animate-in fade-in slide-in-from-top-2 duration-300",
                toast.tone === "ok"
                  ? "bg-green-500/15 text-green-700 dark:text-green-400 ring-green-500/30"
                  : "bg-destructive/15 text-destructive ring-destructive/30",
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
            <p role="alert" className="flex items-center gap-2 text-[13px] font-medium text-destructive">
              <AlertCircle className="size-4" />
              {state.error}
            </p>
          ) : null}

          {!data.isWorkingDay ? (
            <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-4 py-3.5 text-[13px] text-amber-700 dark:text-amber-400 border border-amber-500/20 font-medium">
              <Info className="size-4 shrink-0 mt-0.5" />
              <span>Hari ini bukan hari kerja Anda. Anda tetap dapat absen bila diperbolehkan admin.</span>
            </p>
          ) : null}

          <form action={handleSubmit} className="w-full">
            {hasCheckedIn && hasCheckedOut ? (
              <Button type="button" variant="secondary" size="lg" className="w-full min-h-14 text-[15px] font-semibold" disabled>
                <CheckCircle2 className="size-5" />
                Absensi hari ini selesai
              </Button>
            ) : hasCheckedIn ? (
              <>
                <Button
                  type="submit"
                  size="lg"
                  variant="destructive"
                  className="w-full min-h-16 text-[16px] font-bold gap-2.5 shadow-md"
                  disabled={pending || isLocating}
                >
                  {pending || isLocating ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <LogOut className="size-5" />
                  )}
                  <span>
                    {isLocating
                      ? "Mengambil lokasi…"
                      : pending
                        ? "Memproses…"
                        : "Check-out Sekarang"}
                  </span>
                </Button>
                <input type="hidden" name="intent" value="check-out" />
              </>
            ) : (
              <>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full min-h-16 text-[16px] font-bold gap-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg"
                  disabled={pending || isLocating}
                >
                  {pending || isLocating ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <LogIn className="size-5" />
                  )}
                  <span>
                    {isLocating
                      ? "Mengambil lokasi…"
                      : pending
                        ? "Memproses…"
                        : "Check-in Sekarang"}
                  </span>
                </Button>
                <input type="hidden" name="intent" value="check-in" />
              </>
            )}
          </form>

          <p className="flex items-center gap-2 text-center justify-center text-[11.5px] leading-relaxed text-muted-foreground">
            <Lock className="size-4" />
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
      <p className="flex items-center gap-2.5 text-[13px] text-muted-foreground font-medium">
        <Loader2 className="size-4 animate-spin" />
        Mengambil lokasi Anda…
      </p>
    );
  }

  if (geo.status === "denied" || geo.status === "unavailable") {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg px-4 py-3.5 text-[12.5px] leading-relaxed font-medium border",
          requireLocation
            ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
            : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
        )}
      >
        <MapPinOff className="mt-0.5 size-4 shrink-0" />
        <span>
          {geo.message}
          {requireLocation ? " Lokasi wajib diaktifkan untuk absen." : ""}{" "}
          <Link href="/pengaturan" className="font-semibold underline underline-offset-2 hover:opacity-80">
            Periksa izin
          </Link>
        </span>
      </div>
    );
  }

  if (geo.status === "granted") {
    return (
      <p className="flex items-center gap-2.5 text-[12.5px] text-green-700 dark:text-green-400 font-medium bg-green-500/10 rounded-lg px-3.5 py-2.5 border border-green-500/20">
        <Navigation className="size-4 shrink-0" />
        Lokasi terkunci {geo.accuracy > 0 ? `±${Math.round(geo.accuracy)}m` : ""}
        {distanceMeters !== null ? ` · ${Math.round(distanceMeters)}m dari titik` : ""}
      </p>
    );
  }

  if (outsideRadius) {
    return (
      <p className="flex items-start gap-3 rounded-lg bg-amber-500/15 px-4 py-3.5 text-[12.5px] text-amber-700 dark:text-amber-400 font-medium border border-amber-500/20">
        <Crosshair className="mt-0.5 size-4 shrink-0" />
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