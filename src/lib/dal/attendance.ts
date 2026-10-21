import "server-only";
import { cache } from "react";
import type { AttendanceStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { assertUser, type CurrentUser } from "./auth";
import {
  calculateWorkedMinutes,
  evaluateCheckIn,
  finaliseStatus,
} from "@/lib/attendance/status";
import {
  type GeoPoint,
  validateLocation,
  type GeoFence,
} from "@/lib/attendance/geofence";
import {
  addDaysToDateKey,
  dateKeyToDbDate,
  formatDuration,
  toLocalDateKey,
  isWorkingDay,
  isAttendanceRole,
  type WorkScheduleTimes,
} from "@/lib/attendance/time";
import { summarizeStatuses, type AttendanceSummary } from "@/lib/attendance/summary";
import {
  getActiveFences,
  getEffectiveSchedule,
  getLocationPolicy,
  type EffectiveSchedule,
} from "./settings";

/**
 * Attendance Data Access Layer.
 *
 * All mutating paths run inside a database transaction and lean on the
 * `(userId, workDate)` unique constraint rather than on read-then-write checks
 * in application code, so a double check-in is rejected by PostgreSQL even if
 * two requests race.
 */

export class AttendanceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "ALREADY_CHECKED_IN"
      | "NOT_CHECKED_IN"
      | "ALREADY_CHECKED_OUT"
      | "INVALID_SEQUENCE"
      | "OUTSIDE_LOCATION"
      | "LOCATION_REQUIRED"
      | "NO_FENCE_CONFIGURED"
      | "NOT_A_WORKING_DAY"
      | "NO_SCHEDULE"
      | "ADMIN_EXEMPT",
  ) {
    super(message);
    this.name = "AttendanceError";
  }
}

/**
 * Resolves the signed-in user and rejects roles that are exempt from
 * attendance. Administrators manage the roster instead of clocking in, and the
 * rule is enforced here rather than only in the navigation so a crafted Server
 * Action call cannot create an attendance row for an admin account.
 */
async function assertAttendanceUser(): Promise<CurrentUser> {
  const user = await assertUser();
  if (!isAttendanceRole(user.role)) {
    throw new AttendanceError(
      "Akun administrator tidak perlu melakukan absensi.",
      "ADMIN_EXEMPT",
    );
  }
  return user;
}

export interface EffectiveScheduleWithLocation {
  schedule: EffectiveSchedule;
  fences: GeoFence[];
  requireLocation: boolean;
  timezone: string;
  organizationName: string;
  workingDays: readonly number[];
}

/** Resolves the schedule, geo-fences and policy that apply to one employee. */
export async function getAttendanceContext(
  userId: string,
): Promise<EffectiveScheduleWithLocation> {
  const [schedule, policy, fences] = await Promise.all([
    getEffectiveSchedule(userId),
    getLocationPolicy(),
    getActiveFences(),
  ]);

  return {
    schedule,
    fences,
    requireLocation: policy.requireLocationValidation,
    timezone: policy.timezone,
    organizationName: policy.organizationName,
    workingDays: policy.workingDays,
  };
}

export interface TodaySummary {
  dateKey: string;
  serverNow: Date;
  attendance: {
    id: string;
    status: AttendanceStatus;
    checkInAt: Date | null;
    checkOutAt: Date | null;
    lateMinutes: number;
    workedMinutes: number;
    checkInDistanceM: number | null;
    outsideRadius: boolean;
    notes: string | null;
  } | null;
  schedule: EffectiveSchedule;
  timezone: string;
  isWorkingDay: boolean;
}

export const getTodaySummary = cache(async (): Promise<TodaySummary> => {
  const user = await assertAttendanceUser();
  const context = await getAttendanceContext(user.id);
  const now = new Date();
  const dateKey = toLocalDateKey(now, context.timezone);

  const record = await db.attendance.findUnique({
    where: { userId_workDate: { userId: user.id, workDate: dateKeyToDbDate(dateKey) } },
    select: {
      id: true,
      status: true,
      checkInAt: true,
      checkOutAt: true,
      lateMinutes: true,
      workedMinutes: true,
      checkInDistanceM: true,
      outsideRadius: true,
      notes: true,
    },
  });

  return {
    dateKey,
    serverNow: now,
    attendance: record,
    schedule: context.schedule,
    timezone: context.timezone,
    isWorkingDay: isWorkingDay(dateKey, context.workingDays),
  };
});

export interface CheckInResult {
  id: string;
  status: AttendanceStatus;
  checkInAt: Date;
  lateMinutes: number;
  outsideRadius: boolean;
  distanceMeters: number | null;
}

/**
 * Records a check-in using the server clock.
 *
 * The client may supply coordinates, but never a timestamp — accepting one
 * would let an employee edit their clock simply by changing the device time.
 */
export async function checkIn(input: {
  point?: GeoPoint | null;
  now?: Date;
}): Promise<CheckInResult> {
  const user = await assertAttendanceUser();
  const context = await getAttendanceContext(user.id);

  const now = input.now ?? new Date();
  const dateKey = toLocalDateKey(now, context.timezone);
  // `workDate` is an `@db.Date`: it must be anchored to UTC midnight of the
  // calendar date, not to the zoned instant of local midnight.
  const workDate = dateKeyToDbDate(dateKey);

  if (!isWorkingDay(dateKey, context.workingDays)) {
    throw new AttendanceError(
      "Hari ini bukan hari kerja untuk Anda. Hubungi admin jika ini keliru.",
      "NOT_A_WORKING_DAY",
    );
  }

  // Location policy is evaluated before the transaction so the user gets an
  // immediate, specific error rather than a rolled-back record.
  const point: GeoPoint | null = input.point ?? null;
  const locationOutcome = validateLocation(point, context.fences);

  if (context.requireLocation) {
    if (locationOutcome.kind === "NO_LOCATION" && locationOutcome.reason === "MISSING_COORDINATES") {
      throw new AttendanceError(
        "Validasi lokasi aktif. Izinkan akses lokasi pada perangkat Anda lalu coba lagi.",
        "LOCATION_REQUIRED",
      );
    }
    if (locationOutcome.kind === "NO_LOCATION" && locationOutcome.reason === "NO_FENCE_CONFIGURED") {
      // Fail closed. Enforcement with no fences would otherwise accept every
      // check-in from anywhere, which reads as "location validation is on" while
      // providing none. The settings screen warns about this state, but a warning
      // in the UI is not a control on the server.
      throw new AttendanceError(
        "Validasi lokasi aktif, tetapi belum ada lokasi kerja yang terdaftar. Hubungi admin.",
        "NO_FENCE_CONFIGURED",
      );
    }
    if (locationOutcome.kind === "OUTSIDE") {
      throw new AttendanceError(
        "Anda berada di luar area absensi yang ditentukan.",
        "OUTSIDE_LOCATION",
      );
    }
  }

  const outsideRadius = locationOutcome.kind === "OUTSIDE";
  const distanceMeters = locationOutcome.kind === "VALID" ? locationOutcome.distanceMeters : null;
  const evaluation = evaluateCheckIn(
    now,
    dateKey,
    context.schedule as WorkScheduleTimes,
    context.timezone,
  );

  // `lateMinutes` is frozen at check-in time on purpose: if an admin later
  // widens the tolerance, history still reflects the rule that applied then.
  const record = await db.$transaction(async (tx) => {
    // Re-read inside the transaction so the existing-record case is detected
    // against the same snapshot that performs the insert.
    const existing = await tx.attendance.findUnique({
      where: { userId_workDate: { userId: user.id, workDate } },
      select: { id: true, checkInAt: true },
    });

    if (existing?.checkInAt) {
      throw new AttendanceError(
        "Anda sudah melakukan check-in hari ini.",
        "ALREADY_CHECKED_IN",
      );
    }

    const data = {
      userId: user.id,
      workDate,
      checkInAt: now,
      status: evaluation.status,
      lateMinutes: evaluation.lateMinutes,
      checkInLatitude: point?.latitude ?? null,
      checkInLongitude: point?.longitude ?? null,
      checkInDistanceM: distanceMeters,
      outsideRadius,
    };

    if (existing) {
      return tx.attendance.update({ where: { id: existing.id }, data });
    }
    return tx.attendance.create({ data });
  });

  return {
    id: record.id,
    status: record.status,
    checkInAt: record.checkInAt ?? now,
    lateMinutes: record.lateMinutes,
    outsideRadius: record.outsideRadius,
    distanceMeters: record.checkInDistanceM,
  };
}

export interface CheckOutResult {
  id: string;
  status: AttendanceStatus;
  checkInAt: Date;
  checkOutAt: Date;
  workedMinutes: number;
  lateMinutes: number;
}

/** Closes an open shift using the server clock. */
export async function checkOut(
  input: {
    point?: GeoPoint | null;
    now?: Date;
  } = {},
): Promise<CheckOutResult> {
  const user = await assertAttendanceUser();
  const context = await getAttendanceContext(user.id);

  const now = input.now ?? new Date();
  const dateKey = toLocalDateKey(now, context.timezone);
  const workDate = dateKeyToDbDate(dateKey);

  return db.$transaction(async (tx) => {
    const existing = await tx.attendance.findUnique({
      where: { userId_workDate: { userId: user.id, workDate } },
      select: {
        id: true,
        checkInAt: true,
        checkOutAt: true,
        lateMinutes: true,
      },
    });

    // Without a check-in there is no shift to close. This is the "invalid
    // check-out" case and it must never silently create a record.
    if (!existing || !existing.checkInAt) {
      throw new AttendanceError(
        "Anda belum melakukan check-in hari ini.",
        "NOT_CHECKED_IN",
      );
    }
    if (existing.checkOutAt) {
      throw new AttendanceError(
        "Anda sudah melakukan check-out hari ini.",
        "ALREADY_CHECKED_OUT",
      );
    }
    if (now.getTime() <= existing.checkInAt.getTime()) {
      throw new AttendanceError(
        "Waktu check-out harus lebih akhir dari waktu check-in.",
        "INVALID_SEQUENCE",
      );
    }

    // Plain elapsed time: no scheduled break is deducted. The schedule's
    // `breakMinutes` stays available for payroll, which is where deductions belong.
    const workedMinutes = calculateWorkedMinutes(existing.checkInAt, now);

    let checkOutDistanceM: number | null = null;
    let outsideRadius = false;
    if (input?.point && context.fences.length > 0) {
      const outcome = validateLocation(input.point, context.fences);
      if (outcome.kind === "VALID") {
        checkOutDistanceM = outcome.distanceMeters;
      } else if (outcome.kind === "OUTSIDE") {
        outsideRadius = true;
        checkOutDistanceM = outcome.distanceMeters;
      }
    }

    const updated = await tx.attendance.update({
      where: { id: existing.id },
      data: {
        checkOutAt: now,
        checkOutLatitude: input?.point?.latitude ?? null,
        checkOutLongitude: input?.point?.longitude ?? null,
        checkOutDistanceM,
        outsideRadius: outsideRadius || undefined,
        workedMinutes,
        status: finaliseStatus(existing.lateMinutes),
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      checkInAt: existing.checkInAt,
      checkOutAt: now,
      workedMinutes,
      lateMinutes: existing.lateMinutes,
    };
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface HistoryRow {
  id: string;
  workDate: string;
  dateLabel: string;
  dayLabel: string;
  status: AttendanceStatus;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  checkInTime: string;
  checkOutTime: string;
  lateMinutes: number;
  workedMinutes: number;
  workedLabel: string;
  outsideRadius: boolean;
  distanceLabel: string | null;
  isWorkingDay: boolean;
}

export interface HistoryPage {
  rows: HistoryRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  summary: AttendanceSummary;
}

/** Own attendance history. Always scoped to the signed-in user. */
export async function getOwnHistory(options: {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  status?: AttendanceStatus | "ALL";
}): Promise<HistoryPage> {
  const user = await assertAttendanceUser();
  const context = await getAttendanceContext(user.id);

  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(60, Math.max(5, options.pageSize ?? 15));
  const { from, to } = resolveRange(options.from, options.to, context.timezone);

  const where = {
    userId: user.id,
    workDate: { gte: from, lte: to },
    ...(options.status && options.status !== "ALL" ? { status: options.status } : {}),
  };

  const [total, records, aggregates] = await Promise.all([
    db.attendance.count({ where }),
    db.attendance.findMany({
      where,
      orderBy: { workDate: "desc" },
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
      },
    }),
    db.attendance.aggregate({
      where,
      _count: { id: true },
      _sum: { workedMinutes: true, lateMinutes: true },
    }),
  ]);

  const grouped = await db.attendance.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });

  return {
    rows: records.map((record) => toHistoryRow(record, context.timezone, context.workingDays)),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    summary: summarizeStatuses(grouped, aggregates._sum.workedMinutes ?? 0),
  };
}

function toHistoryRow(
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
  },
  timezone: string,
  workingDays: readonly number[],
): HistoryRow {
  const dateKey = toLocalDateKey(record.workDate, timezone);
  const dayName = new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    timeZone: "UTC",
  }).format(record.workDate);

  return {
    id: record.id,
    workDate: dateKey,
    dateLabel: new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(record.workDate),
    dayLabel: dayName,
    status: record.status,
    checkInAt: record.checkInAt,
    checkOutAt: record.checkOutAt,
    checkInTime: record.checkInAt
      ? new Intl.DateTimeFormat("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: timezone,
        }).format(record.checkInAt)
      : "—",
    checkOutTime: record.checkOutAt
      ? new Intl.DateTimeFormat("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: timezone,
        }).format(record.checkOutAt)
      : "—",
    lateMinutes: record.lateMinutes,
    workedMinutes: record.workedMinutes,
    /*
     * An open shift has no duration yet. Showing "0j 0m" would read as "worked
     * zero minutes", so the placeholder is used and the live card carries the
     * running total instead.
     */
    workedLabel: record.checkOutAt ? formatDuration(record.workedMinutes) : "—",
    outsideRadius: record.outsideRadius,
    distanceLabel: record.checkInDistanceM !== null ? `${Math.round(record.checkInDistanceM)} m` : null,
    isWorkingDay: isWorkingDay(dateKey, workingDays),
  };
}

function resolveRange(
  from: string | undefined,
  to: string | undefined,
  timezone: string,
): { from: Date; to: Date } {
  const todayKey = toLocalDateKey(new Date(), timezone);
  const toKey = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : todayKey;
  const fromKey =
    from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : shiftDateKey(toKey, -29);
  // Swap if the caller passed the range backwards.
  return fromKey <= toKey
    ? { from: dateKeyToDbDate(fromKey), to: dateKeyToDbDate(toKey) }
    : { from: dateKeyToDbDate(toKey), to: dateKeyToDbDate(fromKey) };
}

export function shiftDateKey(dateKey: string, days: number): string {
  return addDaysToDateKey(dateKey, days);
}

export type { EffectiveSchedule, CurrentUser, GeoFence, GeoPoint };