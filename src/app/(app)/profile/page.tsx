import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronRight,
  Mail,
  Phone,
  Building2,
  Clock,
  User,
  Lock,
  Settings as SettingsIcon,
  Shield,
  Smartphone,
  Globe,
  Palette,
  DollarSign,
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-50">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Profile</h1>
        </div>

        {/* Profile Card */}
        <div className="mb-6 rounded-3xl bg-white shadow-sm border border-slate-200/50 p-6 sm:p-8">
          <div className="flex flex-col items-center gap-4">
            <Monogram name={user.name} size="lg" />
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">{user.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span>{ROLE_LABEL[user.role]}</span>
                </span>
                {user.department && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="size-3.5" />
                    {user.department}
                  </span>
                )}
              </div>
            </div>
            <Link
              href="/pengaturan"
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-95"
            >
              <SettingsIcon className="size-4" />
              Edit Pengaturan
            </Link>
          </div>
        </div>

        {/* Settings Menu */}
        <div className="space-y-3 rounded-2xl bg-white shadow-sm border border-slate-200/50 p-4 sm:p-6">
          {/* Account Info Section */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-2">
              Informasi Akun
            </p>

            {/* Email */}
            <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 hover:bg-slate-50 transition-colors cursor-default">
              <div className="flex items-center gap-3 min-w-0">
                <Mail className="size-5 text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                </div>
              </div>
            </div>

            {/* Employee Code */}
            {user.employeeCode && (
              <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 hover:bg-slate-50 transition-colors cursor-default">
                <div className="flex items-center gap-3">
                  <User className="size-5 text-blue-600 shrink-0" />
                  <div>
                    <p className="text-sm text-muted-foreground">Kode Karyawan</p>
                    <p className="text-sm font-medium text-foreground">{user.employeeCode}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Phone */}
            <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 hover:bg-slate-50 transition-colors cursor-default">
              <div className="flex items-center gap-3">
                <Phone className="size-5 text-blue-600 shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Telepon</p>
                  <p className="text-sm font-medium text-foreground">{user.phone ?? "—"}</p>
                </div>
              </div>
            </div>

            {/* Work Schedule */}
            <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 hover:bg-slate-50 transition-colors cursor-default">
              <div className="flex items-center gap-3">
                <Clock className="size-5 text-blue-600 shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Jadwal Kerja</p>
                  <p className="text-sm font-medium text-foreground">{schedule.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {schedule.startTime}–{schedule.endTime} · toleransi {schedule.lateToleranceMinutes} menit
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-slate-200/50" />

          {/* Settings Section */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-2">
              Pengaturan
            </p>

            {/* Language */}
            <button className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 hover:bg-blue-50 transition-colors text-left group">
              <div className="flex items-center gap-3">
                <Globe className="size-5 text-blue-600 shrink-0" />
                <span className="text-sm font-medium text-foreground">Bahasa</span>
              </div>
              <ChevronRight className="size-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </button>

            {/* Appearance */}
            <button className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 hover:bg-blue-50 transition-colors text-left group">
              <div className="flex items-center gap-3">
                <Palette className="size-5 text-blue-600 shrink-0" />
                <span className="text-sm font-medium text-foreground">Tampilan</span>
              </div>
              <ChevronRight className="size-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </button>

            {/* Manage Devices */}
            <button className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 hover:bg-blue-50 transition-colors text-left group">
              <div className="flex items-center gap-3">
                <Smartphone className="size-5 text-blue-600 shrink-0" />
                <span className="text-sm font-medium text-foreground">Kelola Perangkat</span>
              </div>
              <ChevronRight className="size-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </button>

            {/* Application Security */}
            <button className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 hover:bg-blue-50 transition-colors text-left group">
              <div className="flex items-center gap-3">
                <Shield className="size-5 text-blue-600 shrink-0" />
                <span className="text-sm font-medium text-foreground">Keamanan Aplikasi</span>
              </div>
              <ChevronRight className="size-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </button>

            {/* Change Password */}
            <button className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 hover:bg-blue-50 transition-colors text-left group">
              <div className="flex items-center gap-3">
                <Lock className="size-5 text-blue-600 shrink-0" />
                <span className="text-sm font-medium text-foreground">Ubah Password</span>
              </div>
              <ChevronRight className="size-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </button>
          </div>
        </div>

        {/* Password Change Form - Hidden but available */}
        <div className="mt-6 hidden">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
