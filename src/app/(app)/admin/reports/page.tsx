import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Download, Eye, FileClock } from "lucide-react";
import { requireRole } from "@/lib/dal/auth";
import { getAttendanceReport, getDepartments } from "@/lib/dal/reports";
import { AttendanceStatus } from "@/lib/domain";
import { STATUS_DESCRIPTOR, formatDuration } from "@/lib/attendance/time";
import {
  employeeReportApiHref,
  employeeReportDetailHref,
} from "@/lib/report-links";
import { AttendanceFilters } from "@/components/attendance/attendance-filters";
import { Pagination } from "@/components/attendance/pagination";
import { DepartmentSelect } from "@/components/admin/department-select";
import {
  Surface,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceTitle,
  EmptyState,
  Stat,
} from "@/components/layout/primitives";
import { StatusBadge } from "@/components/layout/badges";
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

const ACTION_LINK_CLASS =
  "inline-grid size-8 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none";

/** View-detail and download actions for one employee. */
function ReportActions({
  userId,
  name,
  fromKey,
  toKey,
}: {
  userId: string;
  name: string;
  fromKey: string;
  toKey: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Link
        href={employeeReportDetailHref(userId, fromKey, toKey)}
        aria-label={`Lihat detail absensi ${name}`}
        title={`Lihat detail absensi ${name}`}
        className={ACTION_LINK_CLASS}
      >
        <Eye className="size-4" aria-hidden />
      </Link>
      <a
        href={employeeReportApiHref(userId, fromKey, toKey)}
        download
        aria-label={`Unduh laporan PDF ${name}`}
        title={`Unduh laporan PDF ${name}`}
        className={ACTION_LINK_CLASS}
      >
        <Download className="size-4" aria-hidden />
      </a>
    </div>
  );
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
    getAttendanceReport({ from: from ?? "", to: to ?? "", search, department, status }, { page, pageSize: 25 }),
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
        <Stat label="Terlambat" value={report.summary.late} hint="melewati toleransi" tone="warning" />
        <Stat label="Alpa" value={report.summary.absent} hint="tidak tercatat" tone="danger" />
        <Stat
          label="Izin / Sakit / Cuti"
          value={report.summary.leave}
          hint="tidak masuk resmi"
          tone="info"
        />
      </div>

      <div className="mt-4 sm:mt-5">
        <Suspense fallback={null}>
          <AttendanceFilters
            basePath="/admin/reports"
            showSearch
            extra={<DepartmentSelect basePath="/admin/reports" departments={departments} />}
          />
        </Suspense>
      </div>

      <div className="mt-4 sm:mt-5">
        <Surface className="overflow-hidden">
          <SurfaceHeader>
            <SurfaceTitle>Detail Absensi Karyawan</SurfaceTitle>
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
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <StatusBadge
                            label={descriptor.label}
                            className={descriptor.className}
                            dotClassName={descriptor.dotClassName}
                          />
                          <ReportActions
                            userId={row.userId}
                            name={row.userName}
                            fromKey={report.range.fromKey}
                            toKey={report.range.toKey}
                          />
                        </div>
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
                      <th scope="col" className="px-6 py-3 text-right font-medium">Aksi</th>
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
                          <td className="px-6 py-3.5">
                            <div className="flex justify-end">
                              <ReportActions
                                userId={row.userId}
                                name={row.userName}
                                fromKey={report.range.fromKey}
                                toKey={report.range.toKey}
                              />
                            </div>
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
      </div>
    </div>
  );
}