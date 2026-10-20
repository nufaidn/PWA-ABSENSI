import "server-only";
import { cache } from "react";
import type { AttendanceStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { assertRole, assertUser } from "./auth";
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
} from "@/lib/attendance/summary";
import { dateKeyToDbDate } from "@/lib/attendance/time";

/**
 * Report Data Access Layer.
 *
 * Every function here requires the ADMIN role via `assertRole`, so report data
 * can never be reached through an employee-scoped code path by accident.
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
  from: Date;
  to: Date;
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
    from: dateFromKey(fromKey),
    to: dateFromKey(toKey),
    days: Math.min(days, MAX_REPORT_RANGE_DAYS),
  };
}

/** A `YYYY-MM-DD` filter value, or absent when the caller supplied garbage. */
function isDateKey(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * A `YYYY-MM-DD` key as UTC midnight.
 *
 * Shared with the write path so reads and writes agree on how a key maps to an
 * `@db.Date` value. When these diverged — writes using a zoned instant — every
 * attendance row was stored one day earlier than the shift it described.
 */
function dateFromKey(key: string): Date {
  return dateKeyToDbDate(key);
}

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((dateFromKey(toKey).getTime() - dateFromKey(fromKey).getTime()) / 86_400_000);
}

export function shiftDateKey(dateKey: string, days: number): string {
  const base = dateFromKey(dateKey);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function buildWhere(filters: ReportFilters, range: ResolvedReportRange): Prisma.AttendanceWhereInput {
  const where: Prisma.AttendanceWhereInput = {
    workDate: { gte: range.from, lte: range.to },
  };

  if (filters.status && filters.status !== "ALL") {
    where.status = filters.status;
  }

  if (filters.userId) {
    where.userId = filters.userId;
  }

  const userFilter: Prisma.UserWhereInput = {};
  if (filters.department) {
    userFilter.department = filters.department;
  }
  if (filters.search) {
    // `contains` + `mode: insensitive` keeps the search usable for names typed
    // in any letter case without needing a trigram index at this scale.
    userFilter.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
      { employeeCode: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  if (Object.keys(userFilter).length > 0) {
    where.user = userFilter;
  }

  return where;
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
  const where = buildWhere(filters, range);

  const [total, records, statusGroups, aggregates] = await Promise.all([
    db.attendance.count({ where }),
    db.attendance.findMany({
      where,
      orderBy: [{ workDate: "desc" }, { user: { name: "asc" } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        workDate: true,
        status: true,
        checkInAt: true,
        checkOutAt: true,
        lateMinutes: true,
        workedMinutes: true,
        outsideRadius: true,
        checkInDistanceM: true,
        user: { select: { id: true, name: true, email: true, employeeCode: true, department: true } },
      },
    }),
    db.attendance.groupBy({ by: ["status"], where, _count: { _all: true } }),
    db.attendance.aggregate({ where, _sum: { workedMinutes: true, lateMinutes: true } }),
  ]);

  const summary = summarizeStatuses(statusGroups, aggregates._sum.workedMinutes ?? 0);

  // Trend and per-employee rollups are computed over the whole filtered range,
  // not the current page, so the numbers never contradict the filter bar.
  const trendGroups = await db.attendance.groupBy({
    by: ["workDate", "status"],
    where,
    _count: { _all: true },
    orderBy: { workDate: "asc" },
  });

  const perEmployeeGroups = await db.attendance.groupBy({
    by: ["userId", "status"],
    where,
    _count: { _all: true },
    _sum: { workedMinutes: true },
  });

  const employeeMeta = await db.user.findMany({
    where: { id: { in: [...new Set(perEmployeeGroups.map((g) => g.userId))] } },
    select: { id: true, name: true, email: true, employeeCode: true, department: true },
  });
  const metaById = new Map(employeeMeta.map((u) => [u.id, u]));

  const rollup = new Map<string, PerEmployeeSummary>();
  for (const group of perEmployeeGroups) {
    const meta = metaById.get(group.userId);
    if (!meta) continue;
    const entry = rollup.get(group.userId) ?? {
      userId: meta.id,
      name: meta.name,
      employeeCode: meta.employeeCode,
      department: meta.department,
      summary: emptySummary(),
      averageWorkedMinutes: 0,
    };
    accumulateStatus(entry.summary, group.status, group._count._all);
    entry.summary.totalWorkedMinutes += group._sum.workedMinutes ?? 0;
    rollup.set(group.userId, entry);
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

  return {
    rows: records.map((record) =>
      toReportRow(record, policy.timezone),
    ),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    range,
    summary,
    averageWorkedMinutes: averageWorkedMinutes(aggregates._sum.workedMinutes ?? 0, summary),
    trend: buildDailyTrend(range.fromKey, range.toKey, trendGroups),
    perEmployee,
  };
}

function toReportRow(
  record: {
    id: string;
    workDate: Date;
    status: AttendanceStatus;
    checkInAt: Date | null;
    checkOutAt: Date | null;
    lateMinutes: number;
    workedMinutes: number;
    outsideRadius: boolean;
    checkInDistanceM: number | null;
    user: {
      id: string;
      name: string;
      email: string;
      employeeCode: string | null;
      department: string | null;
    };
  },
  timezone: string,
): ReportRow {
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
    workDate: record.workDate.toISOString().slice(0, 10),
    dateLabel: new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(record.workDate),
    userId: record.user.id,
    userName: record.user.name,
    email: record.user.email,
    employeeCode: record.user.employeeCode,
    department: record.user.department,
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
 * Full result set for CSV export.
 *
 * Deliberately unpaginated but bounded by `MAX_REPORT_RANGE_DAYS`, so a wide
 * filter cannot attempt to serialise an unbounded result set into memory.
 */
export async function getReportForExport(
  filters: ReportFilters,
): Promise<{ rows: ReportRow[]; range: ResolvedReportRange }> {
  await assertRole("ADMIN");
  const policy = await getLocationPolicy();
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: policy.timezone }).format(new Date());
  const range = resolveReportRange(filters.from, filters.to, todayKey);
  const where = buildWhere(filters, range);

  const records = await db.attendance.findMany({
    where,
    orderBy: [{ workDate: "asc" }, { user: { name: "asc" } }],
    select: {
      id: true,
      workDate: true,
      status: true,
      checkInAt: true,
      checkOutAt: true,
      lateMinutes: true,
      workedMinutes: true,
      outsideRadius: true,
      checkInDistanceM: true,
      user: { select: { id: true, name: true, email: true, employeeCode: true, department: true } },
    },
  });

  return { rows: records.map((r) => toReportRow(r, policy.timezone)), range };
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
  const today = dateFromKey(todayKey);
  const range = resolveReportRange(shiftDateKey(todayKey, -29), todayKey, todayKey);

  const [employees, activeEmployees, todayGroups, recentActivity, monthGroups, monthSum] =
    await Promise.all([
      db.user.count(),
      db.user.count({ where: { isActive: true } }),
      db.attendance.groupBy({
        by: ["status"],
        where: { workDate: { gte: today, lte: today } },
        _count: { _all: true },
      }),
      db.attendance.findMany({
        where: { workDate: { gte: today, lte: today }, checkInAt: { not: null } },
        orderBy: { checkInAt: "desc" },
        take: 8,
        select: {
          checkInAt: true,
          checkOutAt: true,
          status: true,
          lateMinutes: true,
          user: { select: { name: true, department: true } },
        },
      }),
      db.attendance.groupBy({
        by: ["status"],
        where: { workDate: { gte: range.from, lte: range.to } },
        _count: { _all: true },
      }),
      db.attendance.aggregate({
        where: { workDate: { gte: range.from, lte: range.to } },
        _sum: { workedMinutes: true },
      }),
    ]);

  const todayCounts = summarizeStatuses(todayGroups, 0);

  return {
    totals: {
      employees,
      activeEmployees,
      todayPresent: todayCounts.present,
      todayLate: todayCounts.late,
      todayAbsent: todayCounts.absent,
      todayOnLeave: todayCounts.leave,
    },
    recentActivity: recentActivity.map((record) => ({
      id: `${record.user.name}-${record.checkInAt?.getTime() ?? 0}`,
      name: record.user.name,
      department: record.user.department,
      status: record.status,
      checkInAt: record.checkInAt,
      checkOutAt: record.checkOutAt,
      lateMinutes: record.lateMinutes,
    })),
    summary: summarizeStatuses(monthGroups, monthSum._sum.workedMinutes ?? 0),
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
  const policy = await getLocationPolicy();
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: policy.timezone }).format(new Date());
  const range = resolveReportRange(shiftDateKey(todayKey, -29), todayKey, todayKey);
  const where: Prisma.AttendanceWhereInput = {
    userId: user.id,
    workDate: { gte: range.from, lte: range.to },
  };

  const [statusGroups, trendGroups, aggregates] = await Promise.all([
    db.attendance.groupBy({ by: ["status"], where, _count: { _all: true } }),
    db.attendance.groupBy({
      by: ["workDate", "status"],
      where,
      _count: { _all: true },
      orderBy: { workDate: "asc" },
    }),
    db.attendance.aggregate({ where, _sum: { workedMinutes: true } }),
  ]);

  const summary = summarizeStatuses(statusGroups, aggregates._sum.workedMinutes ?? 0);

  return {
    summary,
    averageWorkedMinutes: averageWorkedMinutes(aggregates._sum.workedMinutes ?? 0, summary),
    trend: buildDailyTrend(range.fromKey, range.toKey, trendGroups),
    range,
  };
}

/** Distinct departments, for the report filter dropdown. */
export const getDepartments = cache(async (): Promise<string[]> => {
  const rows = await db.user.findMany({
    where: { department: { not: null } },
    distinct: ["department"],
    select: { department: true },
    orderBy: { department: "asc" },
  });
  return rows.map((r) => r.department as string);
});