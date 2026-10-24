import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarPlus, ExternalLink, FileText } from "lucide-react";
import { requireUser } from "@/lib/dal/auth";
import { getOwnLeaveRequests } from "@/lib/dal/leave";
import { getLocationPolicy } from "@/lib/dal/settings";
import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { isAttendanceRole, toLocalDateKey } from "@/lib/attendance/time";
import {
  LEAVE_TYPE_BADGE,
  LEAVE_TYPE_LABEL,
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
import { StatusBadge } from "@/components/layout/badges";
import { LeaveRequestForm } from "@/components/leave/leave-request-form";

export const metadata: Metadata = {
  title: "Cuti, Izin & Sakit",
};

function formatSubmitted(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);
}

/**
 * Employee-facing leave page.
 *
 * The request is effective immediately: the same Server Action marks each
 * working day in the range as LEAVE, so there is no separate "menunggu
 * persetujuan" state to show. The history below is therefore a record of what
 * has already happened.
 */
export default async function LeavePage() {
  const user = await requireUser();
  if (!isAttendanceRole(user.role)) redirect("/admin/overview");

  const [requests, policy] = await Promise.all([
    getOwnLeaveRequests(),
    getLocationPolicy(),
  ]);
  const todayKey = toLocalDateKey(new Date(), policy.timezone);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground sm:text-[26px]">
          Cuti, Izin &amp; Sakit
        </h1>
        <p className="text-[13.5px] text-muted-foreground">
          Ajukan ketidakhadiran tanpa proses persetujuan. Hari kerja pada rentang
          tanggal langsung tercatat sebagai izin/cuti.
        </p>
      </header>

      <Surface accentBar>
        <SurfaceHeader>
          <SurfaceTitle>Pengajuan baru</SurfaceTitle>
          <SurfaceDescription className="mt-1">
            Pilih jenis, tentukan rentang tanggal, lalu lengkapi keterangan. Untuk sakit,
            surat dokter wajib diunggah.
          </SurfaceDescription>
        </SurfaceHeader>
        <LeaveRequestForm todayKey={todayKey} cloudinaryReady={isCloudinaryConfigured()} />
      </Surface>

      <Surface className="mt-5 overflow-hidden sm:mt-6">
        <SurfaceHeader>
          <SurfaceTitle>Riwayat pengajuan</SurfaceTitle>
          <SurfaceDescription className="mt-1">
            {requests.length > 0
              ? `${requests.length} pengajuan tercatat.`
              : "Belum ada pengajuan dari akun ini."}
          </SurfaceDescription>
        </SurfaceHeader>

        {requests.length === 0 ? (
          <EmptyState
            icon={CalendarPlus}
            title="Belum ada pengajuan"
            description="Pengajuan cuti, izin, atau sakit yang Anda kirim akan muncul di sini."
          />
        ) : (
          <ul className="divide-y divide-border">
            {requests.map((request) => {
              const tone = LEAVE_TYPE_BADGE[request.type];
              return (
                <li key={request.id} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          label={LEAVE_TYPE_LABEL[request.type]}
                          className={tone.className}
                          dotClassName={tone.dotClassName}
                        />
                        <p className="text-[13.5px] font-semibold text-foreground">
                          {formatLeaveRange(request.startDate, request.endDate)}
                        </p>
                        <span className="text-[11.5px] text-muted-foreground">
                          {countLeaveDays(request.startDate, request.endDate)} hari
                        </span>
                      </div>
                      {request.reason ? (
                        <p className="mt-2 text-[13px] leading-relaxed text-foreground">
                          {request.reason}
                        </p>
                      ) : (
                        <p className="mt-2 text-[12.5px] italic text-muted-foreground">
                          Tanpa keterangan tambahan.
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-[11.5px] text-muted-foreground">
                      Diajukan {formatSubmitted(request.createdAt, policy.timezone)}
                    </p>
                  </div>

                  {request.type === "SAKIT" ? (
                    <div className="mt-3">
                      {request.doctorNoteUrl ? (
                        <a
                          href={request.doctorNoteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <FileText className="size-3.5" aria-hidden />
                          Lihat surat dokter
                          <ExternalLink className="size-3" aria-hidden />
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                          <FileText className="size-3.5" aria-hidden />
                          Surat dokter tidak tersedia.
                        </span>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Surface>
    </div>
  );
}
