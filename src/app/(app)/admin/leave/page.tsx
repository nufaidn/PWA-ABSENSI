import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, ExternalLink, FileText, Search, X } from "lucide-react";
import { requireRole } from "@/lib/dal/auth";
import { getAllLeaveRequests } from "@/lib/dal/leave";
import { getLocationPolicy } from "@/lib/dal/settings";
import type { LeaveType } from "@/lib/domain";
import {
  LEAVE_TYPE_BADGE,
  LEAVE_TYPE_LABEL,
  LEAVE_TYPE_OPTIONS,
  countLeaveDays,
  formatLeaveRange,
} from "@/lib/leave";
import {
  EmptyState,
  Surface,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceTitle,
} from "@/components/layout/primitives";
import { Monogram, StatusBadge } from "@/components/layout/badges";

export const metadata: Metadata = {
  title: "Cuti & Izin",
};

function readParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : undefined;
}

function formatSubmitted(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);
}

/**
 * Organisation-wide leave history.
 *
 * There is no approval queue: the employee's submission is already effective.
 * This screen exists so an admin can see the reason and, for sakit, open the
 * doctor's note.
 */
export default async function AdminLeavePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN");
  const params = (await searchParams) ?? {};

  const typeParam = readParam(params.type);
  const type = (LEAVE_TYPE_OPTIONS as readonly string[]).includes(typeParam ?? "")
    ? (typeParam as LeaveType)
    : ("ALL" as const);
  const search = readParam(params.search);

  const [requests, policy] = await Promise.all([
    getAllLeaveRequests({ type, search }),
    getLocationPolicy(),
  ]);

  const hasFilters = type !== "ALL" || Boolean(search);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground sm:text-[26px]">
          Cuti, Izin &amp; Sakit
        </h1>
        <p className="text-[13.5px] text-muted-foreground">
          {requests.length} pengajuan terbaru. Setiap pengajuan sudah tercatat sebagai
          izin/cuti pada hari kerja terkait.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3.5 surface-elevated">
        <form
          key={`${type}|${search ?? ""}`}
          className="flex flex-wrap items-center gap-2"
          method="get"
          action="/admin/leave"
        >
          <label htmlFor="leave-type" className="text-[12px] font-medium text-muted-foreground">
            Jenis
          </label>
          <select
            id="leave-type"
            name="type"
            defaultValue={type}
            className="h-9 rounded-lg border border-input bg-card px-2.5 text-[12.5px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <option value="ALL">Semua</option>
            {LEAVE_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {LEAVE_TYPE_LABEL[option]}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              name="search"
              defaultValue={search ?? ""}
              placeholder="Cari nama, kode, atau alasan"
              aria-label="Cari pengajuan"
              className="h-9 min-w-0 rounded-lg border border-input bg-card pl-8 pr-3 text-[12.5px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 sm:w-64"
            />
          </div>

          <button
            type="submit"
            className="h-9 rounded-lg bg-primary px-3.5 text-[12.5px] font-medium text-primary-foreground"
          >
            Terapkan
          </button>
        </form>

        {hasFilters ? (
          <Link
            href="/admin/leave"
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-[12.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
            Reset
          </Link>
        ) : null}
      </div>

      <Surface className="overflow-hidden">
        <SurfaceHeader>
          <SurfaceTitle>Riwayat pengajuan</SurfaceTitle>
          <SurfaceDescription className="mt-1">
            Klik &ldquo;Lihat surat dokter&rdquo; untuk membuka lampiran pengajuan sakit.
          </SurfaceDescription>
        </SurfaceHeader>

        {requests.length === 0 ? (
          <EmptyState
            icon={CalendarPlus}
            title="Belum ada pengajuan"
            description={
              hasFilters
                ? "Tidak ada pengajuan yang cocok dengan filter aktif."
                : "Pengajuan cuti, izin, atau sakit dari karyawan dan magang akan muncul di sini."
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-border lg:hidden">
              {requests.map((request) => {
                const tone = LEAVE_TYPE_BADGE[request.type];
                return (
                  <li key={request.id} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <Monogram name={request.userName} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="truncate text-[13.5px] font-semibold text-foreground">
                            {request.userName}
                          </p>
                          <StatusBadge
                            label={LEAVE_TYPE_LABEL[request.type]}
                            className={tone.className}
                            dotClassName={tone.dotClassName}
                          />
                        </div>
                        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                          {request.employeeCode ?? "—"}
                          {request.department ? ` · ${request.department}` : ""}
                        </p>
                        <p className="mt-2 text-[13px] font-medium text-foreground">
                          {formatLeaveRange(request.startDate, request.endDate)}
                          <span className="ml-2 text-[11.5px] font-normal text-muted-foreground">
                            {countLeaveDays(request.startDate, request.endDate)} hari
                          </span>
                        </p>
                        {request.reason ? (
                          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                            {request.reason}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          {request.doctorNoteUrl ? (
                            <a
                              href={request.doctorNoteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:underline"
                            >
                              <FileText className="size-3.5" aria-hidden />
                              Lihat surat dokter
                              <ExternalLink className="size-3" aria-hidden />
                            </a>
                          ) : null}
                          <span className="text-[11.5px] text-muted-foreground">
                            {formatSubmitted(request.createdAt, policy.timezone)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[900px] text-left text-[13px]">
                <caption className="sr-only">Riwayat pengajuan cuti, izin, dan sakit</caption>
                <thead>
                  <tr className="border-b border-border text-[11.5px] uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-6 py-3 font-medium">Karyawan</th>
                    <th scope="col" className="px-4 py-3 font-medium">Jenis</th>
                    <th scope="col" className="px-4 py-3 font-medium">Tanggal</th>
                    <th scope="col" className="px-4 py-3 font-medium">Keterangan</th>
                    <th scope="col" className="px-4 py-3 font-medium">Surat dokter</th>
                    <th scope="col" className="px-6 py-3 font-medium">Diajukan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {requests.map((request) => {
                    const tone = LEAVE_TYPE_BADGE[request.type];
                    return (
                      <tr key={request.id}>
                        <td className="px-6 py-3.5">
                          <p className="font-medium text-foreground">{request.userName}</p>
                          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                            {request.employeeCode ?? "—"}
                            {request.department ? ` · ${request.department}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge
                            label={LEAVE_TYPE_LABEL[request.type]}
                            className={tone.className}
                            dotClassName={tone.dotClassName}
                          />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {formatLeaveRange(request.startDate, request.endDate)}
                          <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                            {countLeaveDays(request.startDate, request.endDate)} hari
                          </span>
                        </td>
                        <td className="max-w-[22rem] px-4 py-3.5">
                          <span className="line-clamp-2 text-[12.5px] text-muted-foreground">
                            {request.reason ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {request.doctorNoteUrl ? (
                            <a
                              href={request.doctorNoteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                            >
                              <FileText className="size-3.5" aria-hidden />
                              Lihat
                              <ExternalLink className="size-3" aria-hidden />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-[12px] text-muted-foreground">
                          {formatSubmitted(request.createdAt, policy.timezone)}
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
