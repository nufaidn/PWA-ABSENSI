import type { Metadata } from "next";
import { Building2, Globe2, MapPin, ShieldAlert, ShieldCheck, Settings } from "lucide-react";
import { requireRole } from "@/lib/dal/auth";
import { getAllFences, getAllSchedules, getSettings } from "@/lib/dal/settings";
import {
  Surface,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceTitle,
} from "@/components/layout/primitives";
import { AdminFact, AdminHeader } from "@/components/admin/admin-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { LocationList } from "@/components/admin/location-manager";

export const metadata: Metadata = {
  title: "Pengaturan",
};

/** Global settings and geo-fences. SUPER_ADMIN only. */
export default async function SettingsPage() {
  await requireRole("SUPER_ADMIN");

  const [settings, schedules, fences] = await Promise.all([
    getSettings(),
    getAllSchedules(),
    getAllFences(),
  ]);

  const activeFenceCount = fences.filter((fence) => fence.isActive).length;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <AdminHeader
        icon={Settings}
        eyebrow="Super admin"
        title="Pengaturan Sistem"
        description="Konfigurasi organisasi, zona waktu, dan validasi lokasi absensi. Perubahan berlaku untuk seluruh karyawan."
        meta={
          <>
            <AdminFact icon={Building2} label="Organisasi" value={settings.organizationName} />
            <AdminFact icon={Globe2} label="Zona waktu" value={settings.timezone} />
            <AdminFact
              icon={settings.requireLocationValidation ? ShieldCheck : ShieldAlert}
              label="Validasi lokasi"
              value={settings.requireLocationValidation ? "Wajib" : "Opsional"}
              tone={settings.requireLocationValidation ? "success" : "warning"}
            />
            <AdminFact
              icon={MapPin}
              label="Geofence aktif"
              value={activeFenceCount}
              tone={activeFenceCount > 0 ? "primary" : "neutral"}
            />
          </>
        }
      />

      <div className="flex flex-col gap-4 sm:gap-6">
        <Surface className="overflow-hidden">
          <SurfaceHeader>
            <SurfaceTitle className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-accent text-primary">
                <Building2 className="size-3.5" />
              </span>
              Konfigurasi Umum
            </SurfaceTitle>
            <SurfaceDescription className="mt-1">
              Berlaku untuk seluruh karyawan dan tidak dapat diubah oleh admin biasa.
            </SurfaceDescription>
          </SurfaceHeader>

          <SettingsForm
            values={{
              organizationName: settings.organizationName,
              timezone: settings.timezone,
              defaultScheduleId: settings.defaultScheduleId,
              requireLocationValidation: settings.requireLocationValidation,
            }}
            schedules={schedules
              .filter((schedule) => schedule.isActive)
              .map((schedule) => ({ id: schedule.id, name: schedule.name }))}
            activeFenceCount={activeFenceCount}
          />
        </Surface>

        <Surface className="overflow-hidden">
          <SurfaceHeader>
            <SurfaceTitle className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-accent text-primary">
                <MapPin className="size-3.5" />
              </span>
              Lokasi Absensi
            </SurfaceTitle>
            <SurfaceDescription className="mt-1">
              Area geofence yang dipakai untuk memvalidasi check-in. Bila validasi lokasi tidak
              diwajibkan, lokasi tetap dicatat untuk keperluan audit.
            </SurfaceDescription>
          </SurfaceHeader>

          <LocationList
            locations={fences.map((fence) => ({
              id: fence.id,
              name: fence.name,
              address: fence.address,
              latitude: fence.latitude,
              longitude: fence.longitude,
              radiusMeters: fence.radiusMeters,
              isActive: fence.isActive,
            }))}
          />
        </Surface>
      </div>
    </div>
  );
}