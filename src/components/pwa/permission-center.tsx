"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import {
  BadgeCheck,
  Check,
  CircleAlert,
  Info,
  Loader2,
  Lock,
  LockOpen,
  MapPin,
  MapPinOff,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface, SurfaceDescription, SurfaceHeader, SurfaceTitle } from "@/components/layout/primitives";
import { cn } from "@/lib/utils";

/**
 * On-device permission and install status.
 *
 * The browser, not this app, owns every permission decision — so these cards
 * never *change* anything. They read the live state, explain what it means,
 * and walk the operator through the exact settings path for the device in
 * hand. Everything that can change while the screen is open (the permission
 * flip, installation, the service worker) is an external browser signal, so it
 * is read through `useSyncExternalStore` rather than mirrored into state
 * inside an effect.
 */

type GeoPermissionState = "granted" | "prompt" | "denied" | "unknown";

interface PermissionSnapshot {
  state: GeoPermissionState;
  /** Geolocation API present AND a secure context — the only way it works. */
  usable: boolean;
}

type Device = "android" | "ios" | "other";

type WorkerSnapshot = "active" | "registered" | "none" | "unknown";

const NOT_INSTALLED = false;
const NO_WORKER: WorkerSnapshot = "unknown";

/* ------------------------------------------------------------------ */
/* Snapshot readers                                                    */
/* ------------------------------------------------------------------ */

function detectDevice(): Device {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}


/* ------------------------------------------------------------------ */
/* External stores                                                     */
/* ------------------------------------------------------------------ */

const STANDALONE_QUERY = "(display-mode: standalone)";

function subscribeDisplayMode(onStoreChange: () => void): () => void {
  const query = window.matchMedia(STANDALONE_QUERY);
  const onChange = () => onStoreChange();
  const onVisible = () => {
    if (document.visibilityState === "visible") onStoreChange();
  };
  query.addEventListener("change", onChange);
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    query.removeEventListener("change", onChange);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

function subscribeNothing(): () => void {
  return () => {};
}

/**
 * Geolocation permission, kept as a live external store.
 *
 * The `PermissionStatus` object is retained module-level so its `change` event
 * survives React remounts, and every focus/visibility return re-reads it — the
 * path back from the phone's settings app that iOS will not announce.
 */
const permissionListeners = new Set<() => void>();
let permissionSnapshotCache: PermissionSnapshot | null = null;
let watchedStatus: PermissionStatus | null = null;
let watchStarted = false;

/** Shown while the permission state has not been resolved yet. */
const PERMISSION_UNRESOLVED: PermissionSnapshot = { state: "unknown", usable: true };

function currentPermissionSnapshot(): PermissionSnapshot {
  return permissionSnapshotCache ?? PERMISSION_UNRESOLVED;
}

function getServerPermissionSnapshot(): PermissionSnapshot {
  // Same shape as the client's unresolved snapshot, so the hydration render
  // agrees before the real state lands.
  return PERMISSION_UNRESOLVED;
}

function announcePermission(): void {
  for (const listener of [...permissionListeners]) listener();
}

function computeDeviceUsefulness(): boolean {
  const hasGeo = typeof navigator !== "undefined" && "geolocation" in navigator;
  return hasGeo && typeof window !== "undefined" && window.isSecureContext !== false;
}

function cachePermissionSnapshot(): void {
  let state: GeoPermissionState = "unknown";
  if (watchedStatus) state = watchedStatus.state as GeoPermissionState;
  permissionSnapshotCache = { state, usable: computeDeviceUsefulness() };
  announcePermission();
}

/** Forces a re-read; called by the "Periksa Ulang" button and page returns. */
function refreshPermissionSnapshot(): void {
  cachePermissionSnapshot();
}

function ensurePermissionWatch(): void {
  if (watchStarted) return;
  watchStarted = true;
  void navigator.permissions
    .query({ name: "geolocation" })
    .then((status) => {
      watchedStatus = status;
      // The flip back from the phone's settings app announces itself here.
      status.addEventListener("change", () => cachePermissionSnapshot());
      cachePermissionSnapshot();
    })
    .catch(() => {
      // No Permissions API (older engines): the real state still surfaces
      // through the "Minta Izin" attempt, which runs a position request.
      cachePermissionSnapshot();
    });
}

/**
 * Manual fallback for engines the Permissions API does not cover: the outcome
 * of the operator's own attempt becomes the stored state.
 */
function markPermissionOutcome(state: "granted" | "denied"): void {
  permissionSnapshotCache = { state, usable: computeDeviceUsefulness() };
  announcePermission();
}

function subscribePermission(onStoreChange: () => void): () => void {
  permissionListeners.add(onStoreChange);
  ensurePermissionWatch();
  refreshPermissionSnapshot();
  return () => {
    permissionListeners.delete(onStoreChange);
  };
}

/**
 * Service-worker presence, same external-store treatment: read once, then
 * re-read whenever the tab becomes visible again (installing the PWA, or a
 * first registration, lands while the screen is already open).
 */
const workerListeners = new Set<() => void>();
let workerSnapshotCache: WorkerSnapshot | null = null;

function currentWorkerSnapshot(): WorkerSnapshot {
  return workerSnapshotCache ?? NO_WORKER;
}

function getServerWorkerSnapshot(): WorkerSnapshot {
  return NO_WORKER;
}

function announceWorker(): void {
  for (const listener of [...workerListeners]) listener();
}

async function refreshWorkerSnapshot(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    const next: WorkerSnapshot = !registration
      ? "none"
      : registration.active
        ? "active"
        : "registered";
    if (next !== workerSnapshotCache) {
      workerSnapshotCache = next;
      announceWorker();
    }
  } catch {
    workerSnapshotCache = "none";
    announceWorker();
  }
}

function subscribeWorker(onStoreChange: () => void): () => void {
  workerListeners.add(onStoreChange);
  void refreshWorkerSnapshot();
  const onVisible = () => {
    if (document.visibilityState === "visible") void refreshWorkerSnapshot();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    workerListeners.delete(onStoreChange);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

let deviceSnapshotCache: Device | null = null;

function currentDeviceSnapshot(): Device {
  deviceSnapshotCache ??= detectDevice();
  return deviceSnapshotCache;
}

function getServerDeviceSnapshot(): Device {
  return "other";
}

/* ------------------------------------------------------------------ */
/* Presentation                                                        */
/* ------------------------------------------------------------------ */

const STATE_BADGE: Record<GeoPermissionState, { label: string; className: string }> = {
  granted: {
    label: "Diizinkan",
    className: "bg-success-muted text-[oklch(0.34_0.08_163)] ring-success/25",
  },
  prompt: {
    label: "Belum diminta",
    className: "bg-muted text-muted-foreground ring-border",
  },
  denied: {
    label: "Ditolak",
    className: "bg-destructive/10 text-destructive ring-destructive/25",
  },
  unknown: {
    label: "Memeriksa…",
    className: "bg-muted text-muted-foreground ring-border",
  },
};

/** Step-by-step settings path, matched to the device family. */
function DenialInstructions({ device }: { device: Device }) {
  const steps: string[] =
    device === "android"
      ? [
          "Ketuk ikon gembok / ⓘ di samping alamat situs pada bilah alamat.",
          "Pilih menu Izin (Permissions) → Lokasi → Izinkan.",
          "Bila dipasang sebagai aplikasi PWA: kesetelan ponsel → Aplikasi → Attendance → Izin → Lokasi → Izinkan.",
        ]
      : device === "ios"
        ? [
            "Buka aplikasi Pengaturan (Settings).",
            "Pilih Safari (atau Attendance bila dipasang dari layar utama).",
            "Pilih Lokasi → Izinkan, lalu muat ulang halaman ini.",
          ]
        : [
            "Ketuk ikon gembok / ⓘ di bilah alamat.",
            "Setelan situs → Lokasi → Izinkan.",
          ];

  return (
    <ol className="list-decimal space-y-1.5 rounded-lg bg-muted px-4 py-3 pl-9 text-[12.5px] leading-relaxed text-muted-foreground">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );
}

export function LocationPermissionCard() {
  const permission = useSyncExternalStore(
    subscribePermission,
    currentPermissionSnapshot,
    getServerPermissionSnapshot,
  );
  const device = useSyncExternalStore(
    subscribeNothing,
    currentDeviceSnapshot,
    getServerDeviceSnapshot,
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    { kind: "ok"; accuracy: number | null } | { kind: "error"; message: string } | null
  >(null);

  /** Fires the real prompt — or an immediate read when already granted. */
  const requestNow = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    setResult(null);
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBusy(false);
        // Engines without a Permissions API never fire the watch's `change`
        // event, so the operator's own attempt is the stored state there.
        markPermissionOutcome("granted");
        setResult({
          kind: "ok",
          accuracy: position.coords.accuracy > 0 ? position.coords.accuracy : null,
        });
      },
      (error) => {
        setBusy(false);
        if (error.code === error.PERMISSION_DENIED) {
          markPermissionOutcome("denied");
          setResult({
            kind: "error",
            message:
              "Izin lokasi ditolak perangkat ini. Ikuti langkah di bawah, kembali ke halaman ini, lalu ketuk Periksa Ulang.",
          });
        } else {
          setResult({
            kind: "error",
            message:
              "Lokasi tidak dapat ditentukan (posisi/sinyal). Coba di tempat terbuka atau ulangi beberapa detik lagi.",
          });
        }
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }, []);

  const badge = STATE_BADGE[permission.state];
  const isDenied =
    permission.state === "denied" || (permission.usable === false && permission.state !== "granted");
  const isCheckable = permission.usable || permission.state === "granted";

  return (
    <Surface accentBar>
      <SurfaceHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SurfaceTitle className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" />
            Izin Lokasi
          </SurfaceTitle>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ring-inset",
              badge.className,
            )}
            role="status"
          >
            {badge.label}
          </span>
        </div>
        <SurfaceDescription className="mt-1">
          Dipakai untuk memverifikasi area absensi saat check-in dan check-out.
        </SurfaceDescription>
      </SurfaceHeader>

      <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
        {!permission.usable && permission.state !== "granted" ? (
          <p className="flex items-start gap-2.5 rounded-lg bg-warning-muted px-3.5 py-3 text-[12.5px] leading-relaxed text-[oklch(0.42_0.11_76)]">
            <LockOpen className="mt-0.5 size-4 shrink-0" />
            {"Lokasi hanya bisa dipakai pada koneksi aman. Buka situs lewat alamat https:// — alamat http:// (mis. IP LAN) menonaktifkan GPS di browser."}
          </p>
        ) : permission.state === "granted" ? (
          <p className="flex items-start gap-2.5 rounded-lg bg-success-muted px-3.5 py-3 text-[13px] leading-relaxed text-[oklch(0.34_0.08_163)]">
            <BadgeCheck className="mt-0.5 size-4 shrink-0" />
            Lokasi diizinkan. Absensi otomatis melampirkan koordinat untuk validasi area.
          </p>
        ) : (
          <p className="flex items-start gap-2.5 rounded-lg bg-muted px-3.5 py-3 text-[13px] leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            {permission.state === "denied"
              ? "Izin lokasi sedang ditolak perangkat — permintaan dari aplikasi tidak akan muncul sampai diizinkan dari setelan."
              : "Izin belum pernah diminta. Ketuk tombol di bawah, lalu pilih Izinkan ketika perangkat menanyakan lokasi."}
          </p>
        )}

        {result?.kind === "ok" ? (
          <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <Check className="size-3.5 text-[oklch(0.34_0.08_163)]" />
            Sinyal terkunci
            {result.accuracy ? ` ±${Math.round(result.accuracy)} m` : ""} — perangkat siap absen.
          </p>
        ) : null}
        {result?.kind === "error" ? (
          <p
            role="alert"
            className="flex items-start gap-2.5 rounded-lg bg-destructive/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-destructive"
          >
            <MapPinOff className="mt-0.5 size-4 shrink-0" />
            {result.message}
          </p>
        ) : null}

        {isDenied ? <DenialInstructions device={device} /> : null}

        <div className="flex flex-wrap gap-2">
          {isCheckable ? (
            <Button type="button" onClick={requestNow} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
              {busy ? "Mengambil lokasi…" : "Minta Izin Sekarang"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setResult(null);
              // The watch re-reads live; a manual pass adds a visibility/focus
              // independent recompute for engines where the event never fires.
              refreshPermissionSnapshot();
            }}
          >
            <RefreshCw className="size-4" />
            Periksa Ulang
          </Button>
        </div>
      </div>
    </Surface>
  );
}

interface DeviceRow {
  label: string;
  value: string;
  ok: boolean | null;
}

export function PwaStatusCard() {
  const secure = useSyncExternalStore(
    subscribeNothing,
    () => typeof window !== "undefined" && window.isSecureContext === true,
    () => false,
  );
  const installed = useSyncExternalStore(subscribeDisplayMode, detectStandalone, () => NOT_INSTALLED);
  const worker = useSyncExternalStore(
    subscribeWorker,
    currentWorkerSnapshot,
    getServerWorkerSnapshot,
  );
  const device = useSyncExternalStore(
    subscribeNothing,
    currentDeviceSnapshot,
    getServerDeviceSnapshot,
  );

  const rows: DeviceRow[] = [
    {
      label: "Koneksi aman (HTTPS)",
      value: secure ? "Ya" : "Tidak — buka alamat https://",
      ok: secure,
    },
    {
      label: "Aplikasi terpasang (standalone)",
      value: installed ? "Ya" : "Belum — dibuka lewat browser",
      ok: installed,
    },
    {
      label: "Service worker",
      value:
        worker === "unknown"
          ? "Memeriksa…"
          : worker === "active"
            ? "Aktif"
            : worker === "registered"
              ? "Terdaftar, belum aktif"
              : "Belum terdaftar",
      ok: worker === "unknown" ? null : worker !== "none",
    },
  ];

  const installSteps =
    device === "ios"
      ? "Buka situs di Safari → tombol Bagikan (share) → Tambahkan ke Layar Utama."
      : "Ketuk menu ⋮ pada browser → Pasang aplikasi / Tambahkan ke layar utama.";

  return (
    <Surface accentBar>
      <SurfaceHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <SurfaceTitle>Status Perangkat</SurfaceTitle>
        </div>
        <SurfaceDescription className="mt-1">
          Kondisi koneksi dan pemasangan aplikasi pada perangkat ini.
        </SurfaceDescription>
      </SurfaceHeader>

      <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
        <dl className="flex flex-col divide-y divide-border">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4 pb-3 pt-1 first:pt-0 last:pb-0"
            >
              <dt className="text-[13px] text-muted-foreground">{row.label}</dt>
              <dd className="flex items-center gap-2 text-[13px] font-medium">
                {row.ok === false ? (
                  <CircleAlert className="size-3.5 shrink-0 text-destructive" />
                ) : row.ok === true ? (
                  <Check className="size-3.5 shrink-0 text-[oklch(0.34_0.08_163)]" />
                ) : (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                )}
                <span className={cn("text-right", row.ok === false && "text-destructive")}>
                  {row.value}
                </span>
              </dd>
            </div>
          ))}
        </dl>

        {!installed ? (
          <p className="flex items-start gap-2.5 rounded-lg bg-muted px-3.5 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" />
            {installSteps}
          </p>
        ) : null}

        {!secure ? (
          <p className="flex items-start gap-2.5 rounded-lg bg-destructive/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            Halaman dibuka tanpa HTTPS. Izin lokasi, kamera, dan pemasangan PWA dinonaktifkan browser pada koneksi tidak aman.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" />
            Terapkan &amp; Muat Ulang
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Setelah mengubah izin di setelan perangkat, muat ulang halaman ini.
          </span>
        </div>
      </div>
    </Surface>
  );
}
