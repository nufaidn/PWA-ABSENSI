import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  CalendarCheck2,
  CalendarX2,
  Clock,
  UserCheck,
  Users,
} from "lucide-react";
import { requireUser } from "@/lib/dal/auth";
import { getAdminOverview } from "@/lib/dal/reports";
import { hasRole, formatDuration, formatClockTime, STATUS_DESCRIPTOR } from "@/lib/attendance/time";
import { getLocationPolicy } from "@/lib/dal/settings";
import {
  Surface,
  SurfaceBody,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceTitle,
  Stat,
} from "@/components/layout/primitives";
import { StatusBadge, ProgressMeter } from "@/components/layout/badges";
import { AttendanceTrendChart } from "@/components/attendance/charts";
import { LiveAttendanceIndicator } from "@/components/attendance/live-indicator";
import { getAttendanceReport } from "@/lib/dal/reports";

export const metadata: Metadata = {
  title: "Ringkasan Admin",
};

/** Administrator landing page: today's numbers plus a 30-day trend. */
export default async function AdminOverviewPage() {
  const user = await requireUser();
  if (!hasRole(user.role, "ADMIN")) redirect("/dashboard");

  const [overview, policy, trend] = await Promise.all([
    getAdminOverview(),
    getLocationPolicy(),
    getAttendanceReport({ from: "", to: "", status: "ALL" }, { pageSize: 1 }),
  ]);

  const { totals, recentActivity, summary, range } = overview;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground sm:text-[26px]">
          Ringkasan Absensi
        </h1>
        <p className="text-[13.5px] text-muted-foreground">
          Kehadiran hari ini dan performa {range.days} hari terakhir untuk {policy.organizationName}.
        </p>
        <LiveAttendanceIndicator enabled={hasRole(user.role, "ADMIN")} />
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          label="Hadir Hari Ini"
          value={totals.todayPresent}
          hint={`${totals.activeEmployees} karyawan aktif`}
          icon={UserCheck}
          tone="success"
        />
        <Stat
          label="Terlambat Hari Ini"
          value={totals.todayLate}
          hint="melewati toleransi"
          icon={Clock}
          tone={totals.todayLate > 0 ? "warning" : "neutral"}
        />
        <Stat
          label="Alpa Hari Ini"
          value={totals.todayAbsent}
          hint={`${totals.todayOnLeave} sedang izin`}
          icon={CalendarX2}
          tone={totals.todayAbsent > 0 ? "danger" : "neutral"}
        />
        <Stat
          label="Total Karyawan"
          value={totals.employees}
          hint={`${totals.employees - totals.activeEmployees} nonaktif`}
          icon={Users}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Surface>
          <SurfaceHeader>
            <SurfaceTitle>Tren Kehadiran</SurfaceTitle>
            <SurfaceDescription className="mt-1">
              Jumlah karyawan per status kehadiran, {range.fromKey} sampai {range.toKey}.
            </SurfaceDescription>
          </SurfaceHeader>
          <SurfaceBody>
            {summary.totalDays === 0 ? (
              <p className="py-12 text-center text-[13px] text-muted-foreground">
                Belum ada data absensi pada periode ini.
              </p>
            ) : (
              <AttendanceTrendChart data={trend.trend} />
            )}
          </SurfaceBody>
        </Surface>

        <Surface>
          <SurfaceHeader>
            <SurfaceTitle>Performa Periode Ini</SurfaceTitle>
          </SurfaceHeader>
          <SurfaceBody className="space-y-5">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-[12.5px] text-muted-foreground">Tingkat kehadiran</span>
                <span className="tabular text-[12.5px] font-semibold">
                  {summary.attendanceRate}%
                </span>
              </div>
              <ProgressMeter value={summary.attendanceRate} tone="success" label="Tingkat kehadiran" />
            </div>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-[12.5px] text-muted-foreground">Tingkat ketepatan</span>
                <span className="tabular text-[12.5px] font-semibold">
                  {summary.punctualityRate}%
                </span>
              </div>
              <ProgressMeter
                value={summary.punctualityRate}
                tone={summary.punctualityRate >= 90 ? "primary" : "warning"}
                label="Tingkat ketepatan"
              />
            </div>

            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border px-3.5 py-3">
                <dt className="text-[11.5px] text-muted-foreground">Total durasi</dt>
                <dd className="tabular mt-1 text-[17px] font-semibold">
                  {formatDuration(summary.totalWorkedMinutes)}
                </dd>
              </div>
              <div className="rounded-lg border border-border px-3.5 py-3">
                <dt className="text-[11.5px] text-muted-foreground">Rata-rata / hari</dt>
                <dd className="tabular mt-1 text-[17px] font-semibold">
                  {formatDuration(trend.averageWorkedMinutes)}
                </dd>
              </div>
            </dl>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Hadir", value: summary.present, tone: "bg-success" },
                { label: "Terlambat", value: summary.late, tone: "bg-warning" },
                { label: "Alpa", value: summary.absent, tone: "bg-destructive" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border px-3 py-2.5">
                  <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={`size-1.5 rounded-full ${item.tone}`} aria-hidden />
                    {item.label}
                  </dt>
                  <dd className="tabular mt-1 text-base font-semibold">{item.value}</dd>
                </div>
              ))}
            </div>
          </SurfaceBody>
        </Surface>
      </div>

      <Surface className="mt-4 overflow-hidden sm:mt-6">
        <SurfaceHeader>
          <SurfaceTitle>Aktivitas Check-in Terbaru</SurfaceTitle>
          <SurfaceDescription className="mt-1">
            Delapan check-in terakhir tercatat hari ini.
          </SurfaceDescription>
        </SurfaceHeader>

        {recentActivity.length === 0 ? (
          <SurfaceBody>
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              Belum ada yang check-in hari ini.
            </p>
          </SurfaceBody>
        ) : (
          <ul className="divide-y divide-border">
            {recentActivity.map((record) => {
              const descriptor = record.status ? STATUS_DESCRIPTOR[record.status] : null;
              return (
                <li
                  key={record.id}
                  className="flex items-center gap-3 px-5 py-3.5 sm:px-6"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-semibold text-primary">
                    {record.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-foreground">
                      {record.name}
                    </p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {record.department ?? "Tanpa departemen"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular text-[13px] font-medium">
                      {formatClockTime(record.checkInAt, policy.timezone)}
                    </p>
                    {descriptor ? (
                      <StatusBadge
                        label={descriptor.label}
                        className={`${descriptor.className} mt-1`}
                        dotClassName={descriptor.dotClassName}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Surface>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-4">
        <Stat
          label="Rata-rata Kehadiran"
          value={`${summary.attendanceRate}%`}
          hint="seluruh karyawan"
          icon={CalendarCheck2}
          tone="primary"
        />
        <Stat
          label="Shift Belum Selesai"
          value={summary.incomplete}
          hint="check-in tanpa check-out"
          icon={Clock}
          tone={summary.incomplete > 0 ? "info" : "neutral"}
        />
      </div>
    </div>
  );
}