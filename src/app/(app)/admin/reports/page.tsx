import type { Metadata } from "next";
import { Suspense } from "react";
import { FileClock, MapPin } from "lucide-react";
import { requireRole } from "@/lib/dal/auth";
import { getAttendanceReport, getDepartments } from "@/lib/dal/reports";
import { AttendanceStatus } from "@/lib/domain";
import { STATUS_DESCRIPTOR, formatDuration } from "@/lib/attendance/time";
import { AttendanceFilters } from "@/components/attendance/attendance-filters";
import { Pagination } from "@/components/attendance/pagination";
import { ExportCsvButton, ExportHint } from "@/components/admin/export-csv-button";
import { DepartmentSelect } from "@/components/admin/department-select";
import {
  Surface,
  SurfaceBody,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceTitle,
  EmptyState,
  Stat,
} from "@/components/layout/primitives";
import { StatusBadge, ProgressMeter } from "@/components/layout/badges";
import { LiveAttendanceIndicator } from "@/components/attendance/live-indicator";

export const metadata: Metadata = {
  title: "Laporan Absensi",
};

function readParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : undefined;
}

function readPage(value: string | string[] | undefined): number {
  const parsed = Number.parseInt(readParam(value) ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function readStatus(value: string | string[] | undefined): AttendanceStatus | "ALL" {
  const raw = readParam(value) ?? "ALL";
  const allowed = Object.values(AttendanceStatus) as string[];
  return allowed.includes(raw) ? (raw as AttendanceStatus) : "ALL";
}

/**
 * Organization-wide attendance report.
 *
 * `requireRole("ADMIN")` is the gate. The DAL repeats the same check, so this
 * page-level guard is UX rather than the security boundary.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN");
  const params = (await searchParams) ?? {};

  const from = readParam(params.from);
  const to = readParam(params.to);
  const search = readParam(params.search);
  const department = readParam(params.department);
  const status = readStatus(params.status);
  const page = readPage(params.page);

  const [report, departments] = await Promise.all([
    getAttendanceReport({ from: from ?? "", to: to ?? "", search, department, status }, { page: page - 1, pageSize: 25 }),
    getDepartments(),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground sm:text-[26px]">
          Laporan Absensi
        </h1>
        <p className="text-[13.5px] text-muted-foreground">
          {report.range.fromKey} sampai {report.range.toKey} · {report.range.days} hari ·{" "}
          {report.total} catatan
          {department ? ` · departemen ${department}` : ""}
        </p>
        <LiveAttendanceIndicator enabled />
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          label="Hadir"
          value={report.summary.present}
          hint="tepat waktu"
          tone="success"
        />
        <Stat label="Terlambat" value={report.summary.late} hint="perPage terlambat" tone="warning" />
        <Stat label="Alpa" value={report.summary.absent} hint="tidak tercatat" tone="danger" />
        <Stat
          label="Rata-rata Durasi"
          value={formatDuration(report.averageWorkedMinutes)}
          hint="per hari hadir"
        />
      </div>

      <div className="mt-4 sm:mt-5">
        <Suspense fallback={null}>
          <AttendanceFilters
            basePath="/admin/reports"
            showSearch
            extra={
              <>
<DepartmentSelect basePath="/admin/reports" departments={departments} />
              <ExportCsvButton basePath="/api/attendance/export" />
              </>
            }
          />
        </Suspense>
      </div>

      <div className="mt-4 sm:mt-5">
        <ExportHint />
      </div>

      <div className="mt-4 grid gap-4 sm:mt-5 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <Surface className="overflow-hidden">
          <SurfaceHeader>
            <SurfaceTitle>Detail Absensi</SurfaceTitle>
            <SurfaceDescription className="mt-1">
              Setiap baris adalah satu catatan kehadiran karyawan pada satu hari.
            </SurfaceDescription>
          </SurfaceHeader>

          {report.rows.length === 0 ? (
            <EmptyState
              icon={FileClock}
              title="Tidak ada data"
              description="Tidak ada catatan yang cocok dengan filter aktif. Coba perlebar rentang tanggal atau ubah status."
            />
          ) : (
            <>
              {/* Stacked cards on phones; a real table from `lg` up. */}
              <ul className="divide-y divide-border lg:hidden">
                {report.rows.map((row) => {
                  const descriptor = STATUS_DESCRIPTOR[row.status];
                  return (
                    <li key={row.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-semibold text-foreground">
                            {row.userName}
                          </p>
                          <p className="truncate text-[12px] text-muted-foreground">
                            {row.employeeCode ?? "—"} · {row.department ?? "Tanpa departemen"}
                          </p>
                          <p className="mt-1 text-[12px] text-muted-foreground">
                            {row.dateLabel}
                          </p>
                        </div>
                        <StatusBadge
                          label={descriptor.label}
                          className={descriptor.className}
                          dotClassName={descriptor.dotClassName}
                        />
                      </div>
                      <dl className="tabular mt-3 grid grid-cols-4 gap-2 text-[12.5px]">
                        <div>
                          <dt className="text-muted-foreground">Masuk</dt>
                          <dd className="mt-0.5 font-medium">{row.checkInTime}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Keluar</dt>
                          <dd className="mt-0.5 font-medium">{row.checkOutTime}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Durasi</dt>
                          <dd className="mt-0.5 font-medium">
                            {formatDuration(row.workedMinutes)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Telat</dt>
                          <dd className="mt-0.5 font-medium">
                            {row.lateMinutes > 0 ? `${row.lateMinutes}m` : "—"}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  );
                })}
              </ul>

              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[820px] text-left text-[13px]">
                  <caption className="sr-only">Detail absensi seluruh karyawan</caption>
                  <thead>
                    <tr className="border-b border-border text-[11.5px] uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="px-6 py-3 font-medium">Karyawan</th>
                      <th scope="col" className="px-4 py-3 font-medium">Tanggal</th>
                      <th scope="col" className="px-4 py-3 font-medium">Status</th>
                      <th scope="col" className="px-4 py-3 font-medium">Masuk</th>
                      <th scope="col" className="px-4 py-3 font-medium">Keluar</th>
                      <th scope="col" className="px-4 py-3 font-medium">Durasi</th>
                      <th scope="col" className="px-6 py-3 text-right font-medium">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {report.rows.map((row) => {
                      const descriptor = STATUS_DESCRIPTOR[row.status];
                      return (
                        <tr key={row.id}>
                          <td className="px-6 py-3.5">
                            <span className="font-medium text-foreground">{row.userName}</span>
                            <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                              {row.employeeCode ?? "—"} · {row.department ?? "Tanpa departemen"}
                            </span>
                          </td>
                          <td className="tabular px-4 py-3.5 whitespace-nowrap">{row.dateLabel}</td>
                          <td className="px-4 py-3.5">
                            <StatusBadge
                              label={descriptor.label}
                              className={descriptor.className}
                              dotClassName={descriptor.dotClassName}
                            />
                          </td>
                          <td className="tabular px-4 py-3.5">{row.checkInTime}</td>
                          <td className="tabular px-4 py-3.5">{row.checkOutTime}</td>
                          <td className="tabular px-4 py-3.5 whitespace-nowrap">
                            {formatDuration(row.workedMinutes)}
                          </td>
                          <td className="px-6 py-3.5 text-right text-[12px] text-muted-foreground">
                            {row.lateMinutes > 0 ? (
                              <span>Telat {row.lateMinutes} mnt</span>
                            ) : null}
                            {row.outsideRadius ? (
                              <span className="ml-2 inline-flex items-center gap-1">
                                <MapPin className="size-3" />
                                luar radius
                              </span>
                            ) : null}
                            {row.lateMinutes === 0 && !row.outsideRadius ? "—" : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Pagination
                page={report.page}
                pageCount={report.pageCount}
                total={report.total}
                pageSize={report.pageSize}
                basePath="/admin/reports"
                searchParams={{
                  from: report.range.fromKey,
                  to: report.range.toKey,
                  search,
                  department,
                  status: status === "ALL" ? undefined : status,
                }}
              />
            </>
          )}
        </Surface>

        <div className="flex flex-col gap-4 sm:gap-6">
          <Surface>
            <SurfaceHeader>
              <SurfaceTitle>Per Karyawan</SurfaceTitle>
              <SurfaceDescription className="mt-1">
                Rekap kehadiran pada filter aktif.
              </SurfaceDescription>
            </SurfaceHeader>
            <SurfaceBody className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-[12.5px] text-muted-foreground">Kehadiran</span>
                  <span className="tabular text-[12.5px] font-semibold">
                    {report.summary.attendanceRate}%
                  </span>
                </div>
                <ProgressMeter value={report.summary.attendanceRate} tone="success" label="Kehadiran" />
              </div>
              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-[12.5px] text-muted-foreground">Ketepatan</span>
                  <span className="tabular text-[12.5px] font-semibold">
                    {report.summary.punctualityRate}%
                  </span>
                </div>
                <ProgressMeter
                  value={report.summary.punctualityRate}
                  tone={report.summary.punctualityRate >= 90 ? "primary" : "warning"}
                  label="Ketepatan"
                />
              </div>
            </SurfaceBody>
          </Surface>

          <Surface>
            <SurfaceHeader>
              <SurfaceTitle>Ringkasan Per Karyawan</SurfaceTitle>
            </SurfaceHeader>
            {report.perEmployee.length === 0 ? (
              <SurfaceBody>
                <p className="py-6 text-center text-[13px] text-muted-foreground">
                  Tidak ada data.
                </p>
              </SurfaceBody>
            ) : (
              <ul className="divide-y divide-border">
                {report.perEmployee.map((employee) => (
                  <li key={employee.userId} className="px-5 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[13px] font-medium text-foreground">
                        {employee.name}
                      </span>
                      <span className="tabular shrink-0 text-[12.5px] font-semibold">
                        {employee.summary.attendanceRate}%
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                      {employee.employeeCode ?? "—"} · {employee.department ?? "Tanpa departemen"}
                    </p>
                    <div className="mt-2">
                      <ProgressMeter
                        value={employee.summary.attendanceRate}
                        tone={employee.summary.attendanceRate >= 85 ? "success" : "warning"}
                        label={`Kehadiran ${employee.name}`}
                      />
                    </div>
                    <p className="tabular mt-1.5 text-[11.5px] text-muted-foreground">
                      {employee.summary.present} hadir · {employee.summary.late} telat ·{" "}
                      {employee.summary.absent} alpa
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Surface>
        </div>
      </div>
    </div>
  );
}