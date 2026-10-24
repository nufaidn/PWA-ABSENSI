import type { LeaveType } from "@/lib/domain";
import { formatDateKey } from "@/lib/attendance/time";

/**
 * Presentation helpers shared by the employee form, the admin list and the
 * audit log. Kept outside the DAL so Client Components can import the labels
 * without pulling in `firebase-admin`.
 */

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  CUTI: "Cuti",
  IZIN: "Izin",
  SAKIT: "Sakit",
};

export const LEAVE_TYPE_DESCRIPTION: Record<LeaveType, string> = {
  CUTI: "Cuti tahunan atau keperluan pribadi yang direncanakan.",
  IZIN: "Keperluan mendesak di luar cuti. Alasan izin wajib diisi.",
  SAKIT: "Tidak masuk karena sakit. Surat dokter wajib diunggah.",
};

export const LEAVE_TYPE_OPTIONS: readonly LeaveType[] = ["CUTI", "IZIN", "SAKIT"];

/** Badge tones mirror the attendance status palette used across the app. */
export const LEAVE_TYPE_BADGE: Record<
  LeaveType,
  { className: string; dotClassName: string }
> = {
  CUTI: {
    className: "bg-info-muted text-[oklch(0.36_0.09_234)] ring-info/30",
    dotClassName: "bg-info",
  },
  IZIN: {
    className: "bg-warning-muted text-[oklch(0.42_0.11_76)] ring-warning/30",
    dotClassName: "bg-warning",
  },
  SAKIT: {
    className: "bg-destructive/10 text-destructive ring-destructive/25",
    dotClassName: "bg-destructive",
  },
};

/** `24 Okt 2026` for one day, otherwise `24 Okt 2026 – 26 Okt 2026`. */
export function formatLeaveRange(startDate: string, endDate: string): string {
  if (startDate === endDate) return formatDateKey(startDate);
  return `${formatDateKey(startDate)} – ${formatDateKey(endDate)}`;
}

/** Inclusive calendar-day count; matches the 31-day cap in the schema. */
export function countLeaveDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}
