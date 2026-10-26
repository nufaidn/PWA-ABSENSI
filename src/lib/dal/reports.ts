import "server-only";
import { cache } from "react";
import { FieldPath } from "firebase-admin/firestore";
import type { Attendance, AttendanceStatus, User } from "@/lib/domain";
import {
  COLLECTIONS,
  attendanceDocId,
  firestore,
  toAttendance,
  toUser,
} from "@/lib/db";
import { assertRole, assertUser, ForbiddenError, NotFoundError } from "./auth";
import { getLocationPolicy } from "./settings";
import {
  accumulateStatus,
  averageWorkedMinutes,
  buildDailyTrend,
  emptySummary,
  finaliseSummary,
  summarizeStatuses,
  type AttendanceSummary,
  type DailyTrendPoint,
  type StatusGroup,
} from "@/lib/attendance/summary";
import {
  ATTENDANCE_ROLES,
  addDaysToDateKey,
  formatDateKey,
  isAttendanceRole,
} from "@/lib/attendance/time";

/**
 * Report Data Access Layer.
 *
 * Every function here requires the ADMIN role via `assertRole`, so report data
 * can never be reached through an employee-scoped code path by accident.
 *
 * Firestore cannot join attendance to users or run SQL aggregates. The
 * organisation is small enough that fetching the date range once and rolling it
 * up in memory is cheaper and simpler than maintaining denormalised counters —
 * and it keeps historical reports correct when a user is renamed or moved.
 */

export const MAX_REPORT_RANGE_DAYS = 400;

export interface ReportFilters {
  /** Inclusive `YYYY-MM-DD` bounds. */
  from: string;
  to: string;
  /** Free-text match on employee name, email or employee code. */
  search?: string;
  status?: AttendanceStatus | "ALL";
  department?: string;
  userId?: string;
}

export interface ResolvedReportRange {
  fromKey: string;
  toKey: string;
  days: number;
}

export function resolveReportRange(
  from: string | undefined,
  to: string | undefined,
  todayKey: string,
): ResolvedReportRange {
  let toKey = isDateKey(to) ? to : todayKey;
  let fromKey = isDateKey(from) ? from : shiftDateKey(toKey, -29);
  // A reversed range is a user typo, not an error worth rejecting.
  if (fromKey > toKey) [fromKey, toKey] = [toKey, fromKey];

  const days = daysBetween(fromKey, toKey) + 1;
  if (days > MAX_REPORT_RANGE_DAYS) {
    fromKey = shiftDateKey(toKey, -(MAX_REPORT_RANGE_DAYS - 1));
  }

  return {
    fromKey,
    toKey,
    days: Math.min(days, MAX_REPORT_RANGE_DAYS),
  };
}

/** A `YYYY-MM-DD` filter value, or absent when the caller supplied garbage. */
function isDateKey(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round(
    (Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000,
  );
}

export function shiftDateKey(dateKey: string, days: number): string {
  return addDaysToDateKey(dateKey, days);
}

function matchesUserFilters(user: User, filters: ReportFilters): boolean {
  if (!isAttendanceRole(user.role)) return false;
  if (filters.department && user.department !== filters.department) return false;
  const search = filters.search?.trim().toLowerCase();
  if (!search) return true;
  return (
    user.name.toLowerCase().includes(search) ||
    user.email.toLowerCase().includes(search) ||
    (user.employeeCode?.toLowerCase().includes(search) ?? false)
  );
}

async function readUsers(): Promise<Map<string, User>> {
  const snapshot = await firestore.collection(COLLECTIONS.users).get();
  return new Map(snapshot.docs.map((doc) => [doc.id, toUser(doc.id, doc.data())]));
}

async function readAttendanceRange(fromKey: string, toKey: string): Promise<Attendance[]> {
  const snapshot = await firestore
    .collection(COLLECTIONS.attendance)
    .where("workDate", ">=", fromKey)
    .where("workDate", "<=", toKey)
    .get();
  return snapshot.docs.map((doc) => toAttendance(doc.id, doc.data()));
}

async function readOwnAttendance(
  userId: string,
  fromKey: string,
  toKey: string,
): Promise<Attendance[]> {
  const snapshot = await firestore
    .collection(COLLECTIONS.attendance)
    .where(FieldPath.documentId(), ">=", attendanceDocId(userId, fromKey))
    .where(FieldPath.documentId(), "<=", attendanceDocId(userId, toKey))
    .get();
  return snapshot.docs
    .map((doc) => toAttendance(doc.id, doc.data()))
    .filter((record) => record.userId === userId);
}

function statusGroups(records: readonly Attendance[]): StatusGroup[] {
  const counts = new Map<AttendanceStatus, number>();
  for (const record of records) {
    counts.set(record.status, (counts.get(record.status) ?? 0) + 1);
  }
  return [...counts.entries()].map(([status, count]) => ({
    status,
    _count: { _all: count },
  }));
}

function sumWorked(records: readonly Attendance[]): number {
  return records.reduce((sum, record) => sum + record.workedMinutes, 0);
}

function trendGroups(records: readonly Attendance[]) {
  const counts = new Map<string, { status: AttendanceStatus; workDate: string; count: number }>();
  for (const record of records) {
    const key = `${record.workDate}|${record.status}`;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { status: record.status, workDate: record.workDate, count: 1 });
  }
  return [...counts.values()].map((entry) => ({
    status: entry.status,
    workDate: entry.workDate,
    _count: { _all: entry.count },
  }));
}

export interface ReportRow {
  id: string;
  workDate: string;
  dateLabel: string;
  userId: string;
  userName: string;
  email: string;
  employeeCode: string | null;
  department: string | null;
  status: AttendanceStatus;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  checkInTime: string;
  checkOutTime: string;
  lateMinutes: number;
  workedMinutes: number;
  outsideRadius: boolean;
  distanceMeters: number | null;
}

export interface ReportResult {
  rows: ReportRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  range: ResolvedReportRange;
  summary: AttendanceSummary;
  averageWorkedMinutes: number;
  trend: DailyTrendPoint[];
  perEmployee: PerEmployeeSummary[];
}

export interface PerEmployeeSummary {
  userId: string;
  name: string;
  employeeCode: string | null;
  department: string | null;
  summary: AttendanceSummary;
  averageWorkedMinutes: number;
}

/** Paginated attendance report with summary, trend and per-employee rollup. */
export async function getAttendanceReport(
  filters: ReportFilters,
  options: { page?: number; pageSize?: number } = {},
): Promise<ReportResult> {
  await assertRole("ADMIN");
  const policy = await getLocationPolicy();
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: policy.timezone }).format(new Date());
  const range = resolveReportRange(filters.from, filters.to, todayKey);

  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, options.pageSize ?? 25));

  const [records, users] = await Promise.all([
    readAttendanceRange(range.fromKey, range.toKey),
    readUsers(),
  ]);

  const filtered = records.filter((record) => {
    const user = users.get(record.userId);
    if (!user || !matchesUserFilters(user, filters)) return false;
    if (filters.userId && record.userId !== filters.userId) return false;
    if (filters.status && filters.status !== "ALL" && record.status !== filters.status) {
      return false;
    }
    return true;
  });

  const summary = summarizeStatuses(statusGroups(filtered), sumWorked(filtered));

  const perEmployeeCounts = new Map<
    string,
    { status: AttendanceStatus; count: number; workedMinutes: number }
  >();
  for (const record of filtered) {
    const key = `${record.userId}|${record.status}`;
    const existing = perEmployeeCounts.get(key);
    if (existing) {
      existing.count += 1;
      existing.workedMinutes += record.workedMinutes;
    } else {
      perEmployeeCounts.set(key, {
        status: record.status,
        count: 1,
        workedMinutes: record.workedMinutes,
      });
    }
  }

  const rollup = new Map<string, PerEmployeeSummary>();

  // Seed a card for every employee matching the user filters. Without this an
  // employee with no records in the range would silently disappear from the
  // report, which reads as "this person does not exist" rather than "no data".
  // A status filter is the exception: then only employees with a matching
  // record belong in the result.
  if (!filters.status || filters.status === "ALL") {
    for (const user of users.values()) {
      if (!matchesUserFilters(user, filters)) continue;
      if (filters.userId && user.id !== filters.userId) continue;
      rollup.set(user.id, {
        userId: user.id,
        name: user.name,
        employeeCode: user.employeeCode,
        department: user.department,
        summary: emptySummary(),
        averageWorkedMinutes: 0,
      });
    }
  }

  for (const [key, group] of perEmployeeCounts) {
    const userId = key.split("|")[0];
    const user = users.get(userId);
    if (!user) continue;
    const entry = rollup.get(userId) ?? {
      userId: user.id,
      name: user.name,
      employeeCode: user.employeeCode,
      department: user.department,
      summary: emptySummary(),
      averageWorkedMinutes: 0,
    };
    accumulateStatus(entry.summary, group.status, group.count);
    entry.summary.totalWorkedMinutes += group.workedMinutes;
    rollup.set(userId, entry);
  }

  const perEmployee = [...rollup.values()]
    .map((entry) => {
      finaliseSummary(entry.summary);
      entry.averageWorkedMinutes = averageWorkedMinutes(
        entry.summary.totalWorkedMinutes,
        entry.summary,
      );
      return entry;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "id"));

  const sorted = [...filtered].sort((a, b) => {
    const byDate = b.workDate.localeCompare(a.workDate);
    if (byDate !== 0) return byDate;
    return (users.get(a.userId)?.name ?? "").localeCompare(users.get(b.userId)?.name ?? "", "id");
  });
  const total = sorted.length;
  const start = (page - 1) * pageSize;
  const pageRecords = sorted.slice(start, start + pageSize);

  return {
    rows: pageRecords.map((record) => toReportRow(record, users.get(record.userId)!, policy.timezone)),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    range,
    summary,
    averageWorkedMinutes: averageWorkedMinutes(sumWorked(filtered), summary),
    trend: buildDailyTrend(range.fromKey, range.toKey, trendGroups(filtered)),
    perEmployee,
  };
}

function toReportRow(record: Attendance, user: User, timezone: string): ReportRow {
  const time = (value: Date | null) =>
    value
      ? new Intl.DateTimeFormat("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: timezone,
        }).format(value)
      : "—";

  return {
    id: record.id,
    workDate: record.workDate,
    dateLabel: formatDateKey(record.workDate),
    userId: user.id,
    userName: user.name,
    email: user.email,
    employeeCode: user.employeeCode,
    department: user.department,
    status: record.status,
    checkInAt: record.checkInAt,
    checkOutAt: record.checkOutAt,
    checkInTime: time(record.checkInAt),
    checkOutTime: time(record.checkOutAt),
    lateMinutes: record.lateMinutes,
    workedMinutes: record.workedMinutes,
    outsideRadius: record.outsideRadius,
    distanceMeters: record.checkInDistanceM,
  };
}

/**
 * Full attendance history for one employee, used by the PDF export.
 *
 * Bounded by `MAX_REPORT_RANGE_DAYS`, so a hand-crafted URL cannot ask the
 * server to serialise years of records into memory.
 */
export interface EmployeeReport {
  employee: {
    id: string;
    name: string;
    email: string;
    employeeCode: string | null;
    department: string | null;
  };
  rows: ReportRow[];
  range: ResolvedReportRange;
  summary: AttendanceSummary;
  averageWorkedMinutes: number;
}

export async function getEmployeeReport(
  userId: string,
  filters: Pick<ReportFilters, "from" | "to">,
): Promise<EmployeeReport> {
  await assertRole("ADMIN");
  const policy = await getLocationPolicy();
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: policy.timezone }).format(new Date());
  const range = resolveReportRange(filters.from, filters.to, todayKey);

  const [records, users] = await Promise.all([
    readAttendanceRange(range.fromKey, range.toKey),
    readUsers(),
  ]);

  const user = users.get(userId);
  if (!user || !isAttendanceRole(user.role)) {
    throw new NotFoundError("Karyawan tidak ditemukan.");
  }

  const own = records.filter((record) => record.userId === user.id);
  own.sort((a, b) => a.workDate.localeCompare(b.workDate));

  const workedMinutes = sumWorked(own);
  const summary = summarizeStatuses(statusGroups(own), workedMinutes);

  return {
    employee: {
      id: user.id,
      name: user.name,
      email: user.email,
      employeeCode: user.employeeCode,
      department: user.department,
    },
    rows: own.map((record) => toReportRow(record, user, policy.timezone)),
    range,
    summary,
    averageWorkedMinutes: averageWorkedMinutes(workedMinutes, summary),
  };
}

export interface AdminOverview {
  totals: {
    employees: number;
    activeEmployees: number;
    todayPresent: number;
    todayLate: number;
    todayAbsent: number;
    todayOnLeave: number;
  };
  recentActivity: Array<{
    id: string;
    name: string;
    department: string | null;
    status: AttendanceStatus | null;
    checkInAt: Date | null;
    checkOutAt: Date | null;
    lateMinutes: number;
  }>;
  summary: AttendanceSummary;
  range: ResolvedReportRange;
}

/** Headline numbers for the admin landing page. */
export async function getAdminOverview(): Promise<AdminOverview> {
  await assertRole("ADMIN");
  const policy = await getLocationPolicy();
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: policy.timezone }).format(new Date());
  const range = resolveReportRange(shiftDateKey(todayKey, -29), todayKey, todayKey);

  const [users, todayRecords, monthRecords] = await Promise.all([
    readUsers(),
    readAttendanceRange(todayKey, todayKey),
    readAttendanceRange(range.fromKey, range.toKey),
  ]);

  const attendanceUsers = [...users.values()].filter((user) => isAttendanceRole(user.role));
  const employees = attendanceUsers.length;
  const activeEmployees = attendanceUsers.filter((user) => user.isActive).length;

  const todayFiltered = todayRecords.filter((record) => {
    const user = users.get(record.userId);
    return Boolean(user && isAttendanceRole(user.role));
  });
  const monthFiltered = monthRecords.filter((record) => {
    const user = users.get(record.userId);
    return Boolean(user && isAttendanceRole(user.role));
  });

  const todayCounts = summarizeStatuses(statusGroups(todayFiltered), 0);
  const recentActivity = todayFiltered
    .filter((record) => record.checkInAt !== null)
    .sort((a, b) => (b.checkInAt?.getTime() ?? 0) - (a.checkInAt?.getTime() ?? 0))
    .slice(0, 8)
    .map((record) => {
      const user = users.get(record.userId);
      return {
        id: record.id,
        name: user?.name ?? "—",
        department: user?.department ?? null,
        status: record.status,
        checkInAt: record.checkInAt,
        checkOutAt: record.checkOutAt,
        lateMinutes: record.lateMinutes,
      };
    });

  return {
    totals: {
      employees,
      activeEmployees,
      todayPresent: todayCounts.present,
      todayLate: todayCounts.late,
      todayAbsent: todayCounts.absent,
      todayOnLeave: todayCounts.leave,
    },
    recentActivity,
    summary: summarizeStatuses(statusGroups(monthFiltered), sumWorked(monthFiltered)),
    range,
  };
}

/**
 * Personal analytics for the signed-in employee.
 *
 * Distinct from `getAttendanceReport`: no ADMIN role is required, and the
 * `userId` filter comes from the session rather than from any caller-supplied
 * input, so an employee can never widen their own statistics.
 */
export async function getOwnAnalytics(): Promise<{
  summary: AttendanceSummary;
  averageWorkedMinutes: number;
  trend: DailyTrendPoint[];
  range: ResolvedReportRange;
}> {
  const user = await assertUser();
  if (!isAttendanceRole(user.role)) {
    throw new ForbiddenError("Administrator tidak memiliki data absensi.");
  }

  const policy = await getLocationPolicy();
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: policy.timezone }).format(new Date());
  const range = resolveReportRange(shiftDateKey(todayKey, -29), todayKey, todayKey);

  const records = await readOwnAttendance(user.id, range.fromKey, range.toKey);
  const workedMinutes = sumWorked(records);
  const summary = summarizeStatuses(statusGroups(records), workedMinutes);

  return {
    summary,
    averageWorkedMinutes: averageWorkedMinutes(workedMinutes, summary),
    trend: buildDailyTrend(range.fromKey, range.toKey, trendGroups(records)),
    range,
  };
}

/** Distinct departments, for the report filter dropdown. */
export const getDepartments = cache(async (): Promise<string[]> => {
  const users = await readUsers();
  return [...new Set(
    [...users.values()]
      .filter((user) => isAttendanceRole(user.role) && user.department)
      .map((user) => user.department as string),
  )].sort((a, b) => a.localeCompare(b, "id"));
});

export { ATTENDANCE_ROLES };
