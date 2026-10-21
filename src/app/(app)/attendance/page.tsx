import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CalendarX2, Clock, MapPin, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/dal/auth";
import { getOwnHistory } from "@/lib/dal/attendance";
import { AttendanceStatus } from "@/lib/domain";
import { formatDuration, isAttendanceRole, STATUS_DESCRIPTOR } from "@/lib/attendance/time";
import { AttendanceFilters } from "@/components/attendance/attendance-filters";
import { Pagination } from "@/components/attendance/pagination";
import {
  Surface,
  EmptyState,
  LoadingCard,
  Stat,
} from "@/components/layout/primitives";
import { StatusBadge } from "@/components/layout/badges";

export const metadata: Metadata = {
  title: "Riwayat Absensi",
};

function parseStatus(value: string | string[] | undefined): AttendanceStatus | "ALL" {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return "ALL";
  const allowed = Object.values(AttendanceStatus) as string[];
  return allowed.includes(raw) ? (raw as AttendanceStatus) : "ALL";
}

function parseDate(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/**
 * Own attendance history.
 *
 * The scope is fixed to the signed-in employee in the DAL — this page cannot
 * request another employee's records even by tampering with the query string.
 */
export default async function AttendanceHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  // Administrators have no attendance history of their own to show.
  if (!isAttendanceRole(user.role)) redirect("/admin/overview");

  const params = (await searchParams) ?? {};

  const status = parseStatus(params.status);
  const from = parseDate(params.from);
  const to = parseDate(params.to);
  const page = parsePage(params.page);

  const history = await getOwnHistory({ page, pageSize: 20, status, from, to });
  const { summary, rows, pageCount, total } = history;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground sm:text-[26px]">
          Riwayat Absensi
        </h1>
        <p className="text-[13.5px] text-muted-foreground">
          Catatan kehadiran harian Anda beserta durasi kerja dan keterlambatan.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          label="Hadir"
          value={summary.present}
          hint="tepat waktu"
          icon={TrendingUp}
          tone="success"
        />
        <Stat
          label="Terlambat"
          value={summary.late}
          hint="melewati batas toleransi"
          icon={Clock}
          tone={summary.late > 0 ? "warning" : "neutral"}
        />
        <Stat
          label="Alpa"
          value={summary.absent}
          hint="tidak ada catatan"
          icon={CalendarX2}
          tone={summary.absent > 0 ? "danger" : "neutral"}
        />
        <Stat
          label="Total Durasi"
          value={formatDuration(summary.totalWorkedMinutes)}
          hint={`${summary.incomplete} shift terbuka`}
          icon={Clock}
        />
      </div>

      <div className="mt-4 sm:mt-5">
        <Suspense fallback={<LoadingCard />}>
          <AttendanceFilters basePath="/attendance" />
        </Suspense>
      </div>

      <Surface className="mt-4 overflow-hidden sm:mt-5">
        {rows.length === 0 ? (
          <EmptyState
            icon={CalendarX2}
            title="Tidak ada catatan"
            description="Tidak ada data absensi yang cocok dengan filter yang dipilih. Coba ubah rentang tanggal atau status."
          />
        ) : (
          <>
            {/*
              Cards on phones, a table from `sm` up. A horizontally scrolling
              table on a 360px screen is a poor experience, so the stacked
              layout is not merely a fallback.
            */}
            <ul className="divide-y divide-border md:hidden">
              {rows.map((row) => {
                const descriptor = STATUS_DESCRIPTOR[row.status];
                return (
                  <li key={row.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-semibold text-foreground">
                          {row.dayLabel}, {row.dateLabel}
                        </p>
                        {row.isWorkingDay ? null : (
                          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                            Bukan hari kerja
                          </p>
                        )}
                      </div>
                      <StatusBadge
                        label={descriptor.label}
                        className={descriptor.className}
                        dotClassName={descriptor.dotClassName}
                      />
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-[12.5px]">
                      <div>
                        <dt className="text-muted-foreground">Masuk</dt>
                        <dd className="tabular mt-0.5 font-medium">{row.checkInTime}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Keluar</dt>
                        <dd className="tabular mt-0.5 font-medium">{row.checkOutTime}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Durasi</dt>
                        <dd className="tabular mt-0.5 font-medium">{row.workedLabel}</dd>
                      </div>
                    </dl>
                    {(row.lateMinutes > 0 || row.distanceLabel) ? (
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                        {row.lateMinutes > 0 ? (
                          <span>Terlambat {row.lateMinutes} menit</span>
                        ) : null}
                        {row.distanceLabel ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3" />
                            {row.distanceLabel} dari titik absensi
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[680px] text-left text-[13px]">
                <caption className="sr-only">Riwayat absensi harian</caption>
                <thead>
                  <tr className="border-b border-border text-[11.5px] uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-6 py-3 font-medium">
                      Tanggal
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Check-in
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Check-out
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Durasi
                    </th>
                    <th scope="col" className="px-6 py-3 text-right font-medium">
                      Keterangan
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => {
                    const descriptor = STATUS_DESCRIPTOR[row.status];
                    return (
                      <tr key={row.id}>
                        <td className="px-6 py-3.5">
                          <span className="font-medium text-foreground">
                            {row.dayLabel}, {row.dateLabel}
                          </span>
                          {row.isWorkingDay ? null : (
                            <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                             Bukan hari kerja
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge
                            label={descriptor.label}
                            className={descriptor.className}
                            dotClassName={descriptor.dotClassName}
                          />
                        </td>
                        <td className="tabular px-4 py-3.5">{row.checkInTime}</td>
                        <td className="tabular px-4 py-3.5">{row.checkOutTime}</td>
                        <td className="tabular px-4 py-3.5">{row.workedLabel}</td>
                        <td className="px-6 py-3.5 text-right text-[12.5px] text-muted-foreground">
                          {row.lateMinutes > 0 ? `+${row.lateMinutes} mnt` : null}
                          {row.distanceLabel ? (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <MapPin className="size-3" />
                              {row.distanceLabel}
                            </span>
                          ) : null}
                          {row.lateMinutes === 0 && !row.distanceLabel ? "—" : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={history.page}
              pageCount={pageCount}
              total={total}
              pageSize={history.pageSize}
              basePath="/attendance"
              searchParams={{ status: status === "ALL" ? undefined : status, from, to }}
            />
          </>
        )}
      </Surface>
    </div>
  );
}