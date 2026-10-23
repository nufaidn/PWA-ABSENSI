import type { Metadata } from "next";
import { requireUser } from "@/lib/dal/auth";
import { getLocationPolicy } from "@/lib/dal/settings";
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
 * Every permission on this screen belongs to the browser or the OS, not to the
 * app, so the page only reads live state and explains how to change it on the
 * device in hand. Both cards re-read their signal when the tab becomes visible
 * again, which is exactly the moment someone returns from the phone's
 * settings. Account management has its own "Profil" tab in the navigation, so
 * this screen stays purely about the device.
 */
export default async function PengaturanPage() {
  await requireUser();
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
        <LocationPermissionCard />

        <PwaStatusCard />
      </div>
    </div>
  );
}

