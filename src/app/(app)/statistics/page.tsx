import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarCheck2, Clock, Timer, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/dal/auth";
import { getOwnAnalytics } from "@/lib/dal/reports";
import { formatDuration, isAttendanceRole } from "@/lib/attendance/time";
import {
  Surface,
  SurfaceBody,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceTitle,
  EmptyState,
  Stat,
} from "@/components/layout/primitives";
import { ProgressMeter } from "@/components/layout/badges";
import { AttendanceTrendChart, StatusDistributionChart } from "@/components/attendance/charts";
import type { AttendanceStatus } from "@/lib/domain";

export const metadata: Metadata = {
  title: "Statistik",
};

/**
 * Personal attendance statistics.
 *
 * Scoped to the signed-in employee inside the DAL, so no query-string input can
 * widen the range of records this page can reach.
 */
export default async function StatisticsPage() {
  const user = await requireUser();
  // Personal attendance analytics do not apply to administrators.
  if (!isAttendanceRole(user.role)) redirect("/admin/overview");

  const { summary, trend, range, averageWorkedMinutes } = await getOwnAnalytics();

  const distribution = (
    ["PRESENT", "LATE", "ABSENT", "INCOMPLETE", "LEAVE", "HOLIDAY"] as AttendanceStatus[]
  )
    .map((status) => ({
      status,
      value:
        status === "PRESENT"
          ? summary.present
          : status === "LATE"
            ? summary.late
            : status === "ABSENT"
              ? summary.absent
              : status === "INCOMPLETE"
                ? summary.incomplete
                : status === "LEAVE"
                  ? summary.leave
                  : summary.holiday,
    }))
    .filter((item) => item.value > 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground sm:text-[26px]">
          Statistik Kehadiran
        </h1>
        <p className="text-[13.5px] text-muted-foreground">
          Ringkasan kehadiran Anda selama {range.days} hari terakhir.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          label="Tingkat Kehadiran"
          value={`${summary.attendanceRate}%`}
          hint={`${summary.present + summary.late + summary.incomplete} hari hadir`}
          icon={CalendarCheck2}
          tone="success"
        />
        <Stat
          label="Tingkat Ketepatan"
          value={`${summary.punctualityRate}%`}
          hint={`${summary.late} hari terlambat`}
          icon={TrendingUp}
          tone={summary.punctualityRate >= 90 ? "success" : "warning"}
        />
        <Stat
          label="Rata-rata Durasi"
          value={formatDuration(averageWorkedMinutes)}
          hint="per hari hadir"
          icon={Timer}
        />
        <Stat
          label="Total Durasi"
          value={formatDuration(summary.totalWorkedMinutes)}
          hint="akumulasi periode ini"
          icon={Clock}
        />
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:mt-6 sm:gap-6">
        <Surface>
          <SurfaceHeader>
            <SurfaceTitle>Tren Kehadiran Harian</SurfaceTitle>
            <SurfaceDescription className="mt-1">
              Jumlah karyawan per status untuk setiap hari dalam periode.
            </SurfaceDescription>
          </SurfaceHeader>
          <SurfaceBody>
            {summary.totalDays === 0 ? (
              <EmptyState
                icon={CalendarCheck2}
                title="Belum ada data"
                description="Tren kehadiran akan muncul setelah Anda mencatat absensi beberapa hari."
              />
            ) : (
              <AttendanceTrendChart data={trend} />
            )}
          </SurfaceBody>
        </Surface>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <Surface>
            <SurfaceHeader>
              <SurfaceTitle>Distribusi Status</SurfaceTitle>
              <SurfaceDescription className="mt-1">
                Komposisi seluruh catatan pada periode ini.
              </SurfaceDescription>
            </SurfaceHeader>
            <SurfaceBody>
              <StatusDistributionChart data={distribution} />
            </SurfaceBody>
          </Surface>

          <Surface>
            <SurfaceHeader>
              <SurfaceTitle>Ringkasan Angka</SurfaceTitle>
              <SurfaceDescription className="mt-1">
                Perbandingan rata-rata kerja Anda dengan rata-rata organisasi.
              </SurfaceDescription>
            </SurfaceHeader>
            <SurfaceBody className="space-y-5">
              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-[12.5px] text-muted-foreground">Kehadiran</span>
                  <span className="tabular text-[12.5px] font-semibold">
                    {summary.attendanceRate}%
                  </span>
                </div>
                <ProgressMeter
                  value={summary.attendanceRate}
                  tone="success"
                  label="Tingkat kehadiran"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-[12.5px] text-muted-foreground">Ketepatan</span>
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
                  <dt className="text-[11.5px] text-muted-foreground">Hari kerja tercatat</dt>
                  <dd className="tabular mt-1 text-lg font-semibold">{summary.totalDays}</dd>
                </div>
                <div className="rounded-lg border border-border px-3.5 py-3">
                  <dt className="text-[11.5px] text-muted-foreground">Shift belum selesai</dt>
                  <dd className="tabular mt-1 text-lg font-semibold">{summary.incomplete}</dd>
                </div>
              </dl>
            </SurfaceBody>
          </Surface>
        </div>
      </div>
    </div>
  );
}