import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronRight,
  Mail,
  Phone,
  Building2,
  Clock,
  User,
  Key,
  Settings as SettingsIcon,
} from "lucide-react";
import { requireUser } from "@/lib/dal/auth";
import { getEffectiveSchedule } from "@/lib/dal/settings";
import { ROLE_LABEL } from "@/lib/attendance/time";
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
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/8 via-primary/5 to-transparent" />
        <div className="relative mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:gap-6">
            <Monogram name={user.name} size="lg" />
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {user.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Chip>{ROLE_LABEL[user.role]}</Chip>
                {user.department && (
                  <div className="text-sm text-muted-foreground flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted">
                    <Building2 className="size-3.5" />
                    <span>{user.department}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Account Information Card */}
            <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 transition-all hover:border-border/80 hover:bg-card/80">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <User className="size-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Informasi Akun</h2>
                  <p className="text-sm text-muted-foreground">Detail profil Anda</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Email */}
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-border/50 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Mail className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Email
                      </p>
                      <p className="mt-1 text-sm font-medium truncate text-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Employee Code */}
                {user.employeeCode && (
                  <div className="flex items-center justify-between gap-4 pb-4 border-b border-border/50">
                    <div className="flex items-center gap-3">
                      <User className="size-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Kode Karyawan
                        </p>
                        <p className="mt-1 tabular text-sm font-medium text-foreground">
                          {user.employeeCode}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Phone */}
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <Phone className="size-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Telepon
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {user.phone ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Work Schedule */}
                <div className="flex items-center gap-3 pt-2">
                  <Clock className="size-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Jadwal Kerja
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {schedule.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {schedule.startTime}–{schedule.endTime} · toleransi {schedule.lateToleranceMinutes} menit
                      {schedule.isOrganizationDefault ? " (default)" : ""}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Card */}
            <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 transition-all hover:border-border/80 hover:bg-card/80">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Key className="size-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Keamanan</h2>
                  <p className="text-sm text-muted-foreground">Ubah password akun Anda</p>
                </div>
              </div>
              <ChangePasswordForm />
            </div>
          </div>

          {/* Right Column - Settings */}
          <div className="space-y-6">
            {/* Settings Card */}
            <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-sm p-6 transition-all hover:border-primary/50 hover:from-primary/15 hover:to-primary/10">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-lg bg-primary/20 p-2">
                  <SettingsIcon className="size-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Pengaturan</h3>
                  <p className="text-xs text-muted-foreground">Kelola perangkat</p>
                </div>
              </div>

              <Link
                href="/pengaturan"
                className="group relative flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-background/50 border border-border/30 text-sm font-medium text-foreground transition-all hover:bg-background hover:border-primary/50 active:scale-95"
              >
                <span>Pengaturan Perangkat</span>
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </Link>

              <div className="mt-4 space-y-3 rounded-xl bg-background/50 p-3 text-xs text-muted-foreground">
                <p className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>Izin lokasi untuk attendance</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>Status pemasangan aplikasi</span>
                </p>
              </div>
            </div>

            {/* Info Card */}
            <div className="rounded-2xl border border-border/50 bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground text-center">
                Untuk mengubah data akun, hubungi administrator sistem.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
