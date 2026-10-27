import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronRight,
  Mail,
  Phone,
  ShieldCheck,
  Building2,
  Clock,
  User,
  Key,
  Settings as SettingsIcon,
} from "lucide-react";
import { requireUser } from "@/lib/dal/auth";
import { getEffectiveSchedule } from "@/lib/dal/settings";
import { ROLE_LABEL } from "@/lib/attendance/time";
import {
  Surface,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceTitle,
} from "@/components/layout/primitives";
import { Chip, Monogram } from "@/components/layout/badges";
import { ChangePasswordForm } from "@/components/profile/change-password-form";

export const metadata: Metadata = {
  title: "Profil",
};

/** Self-service profile and password management. */
export default async function ProfilePage() {
  const user = await requireUser();
  const schedule = await getEffectiveSchedule(user.id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Header Section */}
        <div className="mb-8 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 p-6 border border-primary/20">
          <div className="flex items-start gap-4 sm:items-center">
            <Monogram name={user.name} size="lg" />
            <div className="flex-1">
              <h1 className="text-[24px] font-bold tracking-tight text-foreground sm:text-[28px]">
                {user.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Chip>{ROLE_LABEL[user.role]}</Chip>
                {user.department && (
                  <span className="text-[12px] text-muted-foreground flex items-center gap-1">
                    <Building2 className="size-3.5" />
                    {user.department}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:gap-6">
          {/* Informasi Akun Section */}
          <Surface className="overflow-hidden">
            <SurfaceHeader>
              <SurfaceTitle>Informasi Akun</SurfaceTitle>
              <SurfaceDescription className="mt-1">
                Detail profil Anda yang dikelola oleh sistem.
              </SurfaceDescription>
            </SurfaceHeader>

            <div className="divide-y divide-border px-5 py-4 sm:px-6">
              {/* Email */}
              <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <Mail className="size-4 text-primary shrink-0" />
                  <div>
                    <p className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                      Email
                    </p>
                    <p className="mt-1 text-[13.5px] font-medium truncate">{user.email}</p>
                  </div>
                </div>
              </div>

              {/* Employee Code */}
              {user.employeeCode && (
                <div className="flex items-center justify-between gap-4 py-4">
                  <div className="flex items-center gap-3">
                    <User className="size-4 text-primary shrink-0" />
                    <div>
                      <p className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                        Kode Karyawan
                      </p>
                      <p className="mt-1 tabular text-[13.5px] font-medium">{user.employeeCode}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Phone */}
              <div className="flex items-center justify-between gap-4 py-4">
                <div className="flex items-center gap-3">
                  <Phone className="size-4 text-primary shrink-0" />
                  <div>
                    <p className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                      Telepon
                    </p>
                    <p className="mt-1 text-[13.5px] font-medium">{user.phone ?? "—"}</p>
                  </div>
                </div>
              </div>

              {/* Work Schedule */}
              <div className="flex items-center justify-between gap-4 py-4">
                <div className="flex items-center gap-3">
                  <Clock className="size-4 text-primary shrink-0" />
                  <div>
                    <p className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                      Jadwal Kerja
                    </p>
                    <p className="mt-1 text-[13.5px] font-medium">
                      {schedule.name}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      {schedule.startTime}–{schedule.endTime} · toleransi {schedule.lateToleranceMinutes} menit
                      {schedule.isOrganizationDefault ? " (default)" : ""}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Surface>

          {/* Keamanan Section */}
          <Surface className="overflow-hidden">
            <SurfaceHeader>
              <SurfaceTitle className="flex items-center gap-2">
                <Key className="size-5 text-primary" />
                Keamanan
              </SurfaceTitle>
              <SurfaceDescription className="mt-1">
                Kelola password akun Anda. Password baru berlaku pada login berikutnya.
              </SurfaceDescription>
            </SurfaceHeader>
            <ChangePasswordForm />
          </Surface>

          {/* Pengaturan Section */}
          <Surface className="overflow-hidden">
            <SurfaceHeader>
              <SurfaceTitle className="flex items-center gap-2">
                <SettingsIcon className="size-5 text-primary" />
                Pengaturan Perangkat
              </SurfaceTitle>
              <SurfaceDescription className="mt-1">
                Kelola izin lokasi dan status pemasangan aplikasi pada perangkat Anda.
              </SurfaceDescription>
            </SurfaceHeader>
            <div className="px-5 py-5 sm:px-6">
              <Link
                href="/pengaturan"
                className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-gradient-to-r from-primary/5 to-transparent p-4 text-[13.5px] font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/10 active:scale-95"
              >
                <span className="flex items-center gap-2.5">
                  <ShieldCheck className="size-4 text-primary" />
                  Buka Pengaturan Perangkat
                </span>
                <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </Surface>

          {/* Footer Note */}
          <div className="text-center text-[12px] text-muted-foreground p-4">
            <p>Untuk mengubah data akun, hubungi administrator sistem.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
