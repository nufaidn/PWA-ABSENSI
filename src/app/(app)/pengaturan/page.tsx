import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/dal/auth";
import { getLocationPolicy } from "@/lib/dal/settings";
import { isAttendanceRole } from "@/lib/attendance/time";
import {
  LocationPermissionCard,
  PwaStatusCard,
} from "@/components/pwa/permission-center";

export const metadata: Metadata = {
  title: "Pengaturan",
};

/**
 * Device settings hub, reached through the mobile gear tab.
 *
 * Device settings hub, reached through the mobile gear tab.
 *
 * The permission cards belong to the browser or the OS, not to the app, so they
 * only read live state and explain how to change it on the device in hand. The
 * leave shortcut at the top is a discoverability aid: on a phone the bottom bar
 * is already full, and employees who look for "Pengaturan" first should still
 * find the cuti/izin form without hunting through the navigation.
 */
export default async function PengaturanPage() {
  const user = await requireUser();
  const policy = await getLocationPolicy();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground sm:text-[26px]">
          Pengaturan
        </h1>
        <p className="text-[13.5px] text-muted-foreground">
          Izin perangkat dan kondisi aplikasi pada perangkat ini
          {policy.requireLocationValidation ? " — validasi lokasi sedang diwajibkan oleh organisasi." : "."}
        </p>
      </header>

      <div className="flex flex-col gap-4 sm:gap-6">
        {isAttendanceRole(user.role) ? (
          <Link
            href="/cuti-izin"
            className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 surface-elevated transition-colors hover:bg-muted/60 sm:p-5"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
              <CalendarPlus className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-semibold text-foreground">
                  Cuti / Izin
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
              <span className="mt-1 block text-[12.5px] leading-relaxed text-muted-foreground">
                Ajukan Izin Dan Cuti disini
              </span>
            </span>
          </Link>
        ) : null}

        <LocationPermissionCard />

        <PwaStatusCard />
      </div>
    </div>
  );
}

