import { toCsv, csvFilename } from "@/lib/csv";
import { STATUS_DESCRIPTOR } from "@/lib/attendance/time";
import type { ReportRow } from "@/lib/dal/reports";

/**
 * CSV export of an attendance report.
 *
 * This lives in a plain utility (not a `"use server"` module) so it can be unit
 * tested directly; the route handler below owns the authorization and the
 * `Content-Disposition` header.
 */

export const REPORT_COLUMNS: Array<{ header: string; value: (row: ReportRow) => unknown }> = [
  { header: "Tanggal", value: (row) => row.workDate },
  { header: "ID Karyawan", value: (row) => row.employeeCode ?? "" },
  { header: "Nama", value: (row) => row.userName },
  { header: "Email", value: (row) => row.email },
  { header: "Departemen", value: (row) => row.department ?? "" },
  { header: "Status", value: (row) => STATUS_DESCRIPTOR[row.status].label },
  { header: "Check-in", value: (row) => row.checkInTime },
  { header: "Check-out", value: (row) => row.checkOutTime },
  { header: "Terlambat (menit)", value: (row) => row.lateMinutes },
  { header: "Durasi (menit)", value: (row) => row.workedMinutes },
  {
    header: "Di Luar Radius",
    value: (row) => (row.outsideRadius ? "Ya" : "Tidak"),
  },
  { header: "Jarak dari Titik (m)", value: (row) => (row.distanceMeters ?? "") },
];

export function buildReportCsv(rows: readonly ReportRow[]): string {
  return toCsv(rows, REPORT_COLUMNS);
}

export function reportFilename(fromKey: string, toKey: string): string {
  return csvFilename(
    `absensi-${fromKey}-sampai-${toKey}`,
    new Date().toISOString().slice(0, 10),
  );
}