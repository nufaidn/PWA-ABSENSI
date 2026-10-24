import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CalendarX2,
  Clock,
  Download,
  FileClock,
  MapPin,
  UserCheck,
} from "lucide-react";
import { NotFoundError, requireRole } from "@/lib/dal/auth";
import { getEmployeeReport } from "@/lib/dal/reports";
import { STATUS_DESCRIPTOR, formatDuration } from "@/lib/attendance/time";
import { employeeReportApiHref, reportListHref } from "@/lib/report-links";
import {
  EmptyState,
  Stat,
  Surface,
  SurfaceBody,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceTitle,
} from "@/components/layout/primitives";
import { StatusBadge } from "@/components/layout/badges";

export const metadata: Metadata = {
  title: "Detail Absensi Karyawan",
};

function readParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : undefined;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 truncate text-[13.5px] font-medium text-foreground">{value}</dd>
    </div>
  );
}

/** Record notes moved out of the report table: late minutes and geofence status. */
function RecordNote({ lateMinutes, outsideRadius, distanceMeters }: {
  lateMinutes: number;
  outsideRadius: boolean;
  distanceMeters: number | null;
}) {
  if (lateMinutes <= 0 && !outsideRadius) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
      {lateMinutes > 0 ? <span>Telat {lateMinutes} mnt</span> : null}
      {outsideRadius ? (
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3" aria-hidden />
          luar radius
          {distanceMeters !== null ? ` (${Math.round(distanceMeters)} m)` : ""}
        </span>
      ) : null}
    </span>
  );
}

/**
 * One employee's attendance history for the active report range.
 *
 * Reached from the eye action in the organisation-wide report. The PDF route
 * renders the same data, so this page doubles as an on-screen preview.
 */
export default async function EmployeeReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN");
  const { userId } = await params;
  const query = (await searchParams) ?? {};

  const report = await getEmployeeReport(userId, {
    from: readParam(query.from) ?? "",
    to: readParam(query.to) ?? "",
  }).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  // Newest first on screen; the PDF keeps chronological order for printing.
  const rows = [...report.rows].reverse();
  const { employee, range, summary } = report;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href={reportListHref(range.fromKey, range.toKey)}
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Kembali ke laporan
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground sm:text-[26px]">
            Detail Absensi Karyawan
          </h1>
          <p className="text-[13.5px] text-muted-foreground">
            {employee.name} · {range.fromKey} sampai {range.toKey} · {range.days} hari
          </p>
        </div>
        <a
          href={employeeReportApiHref(employee.id, range.fromKey, range.toKey)}
          download
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <Download className="size-4" aria-hidden />
          Unduh PDF
        </a>
      </header>

      <Surface>
        <SurfaceHeader>
          <SurfaceTitle>Informasi Karyawan</SurfaceTitle>
        </SurfaceHeader>
        <SurfaceBody>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Nama" value={employee.name} />
            <Detail label="ID" value={employee.employeeCode ?? "—"} />
            <Detail label="Departemen" value={employee.department ?? "—"} />
            <Detail label="Email" value={employee.email} />
          </dl>
        </SurfaceBody>
      </Surface>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          label="Hadir"
          value={summary.present}
          hint="tepat waktu"
          icon={UserCheck}
          tone="success"
        />
        <Stat
          label="Terlambat"
          value={summary.late}
          hint="melewati toleransi"
          icon={Clock}
          tone={summary.late > 0 ? "warning" : "neutral"}
        />
        <Stat
          label="Alpa"
          value={summary.absent}
          hint="tidak tercatat"
          icon={CalendarX2}
          tone={summary.absent > 0 ? "danger" : "neutral"}
        />
        <Stat
          label="Izin / Cuti"
          value={summary.leave}
          hint="tidak masuk resmi"
          icon={CalendarDays}
          tone="info"
        />
      </div>

      <Surface className="mt-4 overflow-hidden sm:mt-6">
        <SurfaceHeader>
          <SurfaceTitle>Riwayat Absensi</SurfaceTitle>
          <SurfaceDescription className="mt-1">
            {rows.length} catatan · total {formatDuration(summary.totalWorkedMinutes)} · kehadiran{" "}
            {summary.attendanceRate}% · ketepatan {summary.punctualityRate}%
          </SurfaceDescription>
        </SurfaceHeader>

        {rows.length === 0 ? (
          <EmptyState
            icon={FileClock}
            title="Belum ada catatan"
            description="Karyawan ini belum memiliki catatan absensi pada periode yang dipilih."
          />
        ) : (
          <>
            <ul className="divide-y divide-border lg:hidden">
              {rows.map((row) => {
                const descriptor = STATUS_DESCRIPTOR[row.status];
                return (
                  <li key={row.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[13.5px] font-semibold text-foreground">{row.dateLabel}</p>
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
                        <dd className="mt-0.5 font-medium">{formatDuration(row.workedMinutes)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Telat</dt>
                        <dd className="mt-0.5 font-medium">
                          {row.lateMinutes > 0 ? `${row.lateMinutes}m` : "—"}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-2">
                      <RecordNote
                        lateMinutes={row.lateMinutes}
                        outsideRadius={row.outsideRadius}
                        distanceMeters={row.distanceMeters}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[760px] text-left text-[13px]">
                <caption className="sr-only">Riwayat absensi {employee.name}</caption>
                <thead>
                  <tr className="border-b border-border text-[11.5px] uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-6 py-3 font-medium">Tanggal</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 font-medium">Masuk</th>
                    <th scope="col" className="px-4 py-3 font-medium">Keluar</th>
                    <th scope="col" className="px-4 py-3 font-medium">Telat</th>
                    <th scope="col" className="px-4 py-3 font-medium">Durasi</th>
                    <th scope="col" className="px-6 py-3 font-medium">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => {
                    const descriptor = STATUS_DESCRIPTOR[row.status];
                    return (
                      <tr key={row.id}>
                        <td className="tabular px-6 py-3.5 whitespace-nowrap">{row.dateLabel}</td>
                        <td className="px-4 py-3.5">
                          <StatusBadge
                            label={descriptor.label}
                            className={descriptor.className}
                            dotClassName={descriptor.dotClassName}
                          />
                        </td>
                        <td className="tabular px-4 py-3.5">{row.checkInTime}</td>
                        <td className="tabular px-4 py-3.5">{row.checkOutTime}</td>
                        <td className="tabular px-4 py-3.5">
                          {row.lateMinutes > 0 ? `${row.lateMinutes} mnt` : "—"}
                        </td>
                        <td className="tabular px-4 py-3.5 whitespace-nowrap">
                          {formatDuration(row.workedMinutes)}
                        </td>
                        <td className="px-6 py-3.5">
                          <RecordNote
                            lateMinutes={row.lateMinutes}
                            outsideRadius={row.outsideRadius}
                            distanceMeters={row.distanceMeters}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Surface>
    </div>
  );
}
