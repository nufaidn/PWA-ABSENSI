/**
 * Plain-data shapes shared by the report list, the detail dialog and the JSON
 * route that backs it.
 *
 * Kept free of `server-only` imports so a Client Component can consume them.
 */
import type { AttendanceStatus } from "@/lib/domain";
import type { AttendanceSummary } from "@/lib/attendance/summary";

export interface EmployeeReportCardSummary {
  userId: string;
  name: string;
  employeeCode: string | null;
  department: string | null;
  summary: AttendanceSummary;
  averageWorkedMinutes: number;
}

export interface EmployeeReportDetailRow {
  id: string;
  dateLabel: string;
  status: AttendanceStatus;
  checkInTime: string;
  checkOutTime: string;
  lateMinutes: number;
  workedMinutes: number;
  outsideRadius: boolean;
  distanceMeters: number | null;
}

export interface EmployeeReportDetail {
  employee: {
    id: string;
    name: string;
    email: string;
    employeeCode: string | null;
    department: string | null;
  };
  range: {
    fromKey: string;
    toKey: string;
    days: number;
  };
  summary: AttendanceSummary;
  averageWorkedMinutes: number;
  rows: EmployeeReportDetailRow[];
}
