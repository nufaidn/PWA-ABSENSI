import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Clock, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/dal/auth";
import { getTodaySummary } from "@/lib/dal/attendance";
import { formatShortDate, isAttendanceRole } from "@/lib/attendance/time";
import { AttendanceCard } from "@/components/attendance/attendance-card";

export const metadata: Metadata = {
  title: "Beranda",
};

/**
 * Employee home screen.
 *
 * Deliberately only the clock-in control and a greeting. The statistics, the
 * 30-day summary and the recent-activity list all moved out: this screen is
 * opened dozens of times a day with one intent — record attendance — and every
 * extra block pushed the button further down the fold. Trends live in
 * `/statistics` and the full record in `/attendance`, both one tap away in the
 * navigation.
 *
 * The history query is gone with them, so the page now loads in a single round
 * trip.
 */
export default async function DashboardPage() {
  const user = await requireUser();
  // Administrators manage attendance instead of recording it.
  if (!isAttendanceRole(user.role)) redirect("/admin/overview");

  const today = await getTodaySummary();

  const { attendance, schedule, timezone } = today;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Header Section */}
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                {formatShortDate(today.serverNow, timezone)}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground sm:text-[32px]">
                  Halo, {user.name.split(" ")[0]}
                </h1>
              </div>
              {user.department && (
                <p className="mt-1 text-[14px] text-muted-foreground">{user.department}</p>
              )}
            </div>
          </div>
        </header>

        {/* Main Attendance Card */}
        <div className="mb-6">
          <AttendanceCard
            data={{
              status: attendance?.status ?? null,
              checkInAt: attendance?.checkInAt?.toISOString() ?? null,
              checkOutAt: attendance?.checkOutAt?.toISOString() ?? null,
              lateMinutes: attendance?.lateMinutes ?? 0,
              workedMinutes: attendance?.workedMinutes ?? 0,
              distanceMeters: attendance?.checkInDistanceM ?? null,
              outsideRadius: attendance?.outsideRadius ?? false,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              lateToleranceMinutes: schedule.lateToleranceMinutes,
              scheduleNote: schedule.description,
              requireLocation: today.requireLocation,
              isWorkingDay: today.isWorkingDay,
              timezone,
              serverNow: today.serverNow.toISOString(),
              serverTimezone: timezone,
            }}
          />
        </div>

        {/* Quick Links Section */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickLink
            href="/statistics"
            icon={TrendingUp}
            label="Statistik"
            description="Performa Anda"
          />
          <QuickLink
            href="/cuti-izin"
            icon={Clock}
            label="Cuti & Izin"
            description="Pengajuan"
          />
        </div>

        {/* Info Section */}
        {/* <div className="mt-8 space-y-3">
          <InfoCard
            title="Jadwal Kerja"
            description={`${schedule.startTime} - ${schedule.endTime}`}
            accent="blue"
          />
          {schedule.description && (
            <InfoCard
              title="Catatan Jadwal"
              description={schedule.description}
              accent="violet"
            />
          )}
          <InfoCard
            title="Toleransi Keterlambatan"
            description={`${schedule.lateToleranceMinutes} menit`}
            accent="green"
          />
        </div> */}
      </div>
    </div>
  );
}

interface QuickLinkProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
}

function QuickLink({ href, icon: Icon, label, description }: QuickLinkProps) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/50 hover:bg-card hover:shadow-md active:scale-95 sm:p-4"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative flex flex-col gap-2">
        <Icon className="size-5 text-muted-foreground transition-colors group-hover:text-primary sm:size-6" />
        <div>
          <p className="text-[13px] font-semibold text-foreground sm:text-[14px]">{label}</p>
          <p className="text-[11px] text-muted-foreground sm:text-[12px]">{description}</p>
        </div>
      </div>
    </Link>
  );
}

interface InfoCardProps {
  title: string;
  description: string;
  accent: "blue" | "violet" | "green";
}

function InfoCard({ title, description, accent }: InfoCardProps) {
  const accentClasses = {
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400",
    violet: "bg-violet-500/10 border-violet-500/20 text-violet-700 dark:text-violet-400",
    green: "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400",
  };

  return (
    <div className={`rounded-lg border p-3.5 ${accentClasses[accent]}`}>
      <p className="text-[12px] font-medium uppercase tracking-wide opacity-75">{title}</p>
      <p className="mt-1 text-[14px] font-semibold">{description}</p>
    </div>
  );
}