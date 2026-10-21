/**
 * Attendance status determination — pure logic, no I/O.
 *
 * Kept separate from the data layer so the rules that decide "late" and
 * "worked minutes" can be unit tested without a database or a server clock.
 */
import type { AttendanceStatus } from "@/lib/domain";
import {
  MS_PER_MINUTE,
  formatTimeString,
  getTimeZoneOffsetMinutes,
  parseTimeString,
  type WorkScheduleTimes,
} from "./time";

/**
 * Resolves a local wall-clock time on `dateKey` into a real UTC instant.
 *
 * Uses the standard two-pass offset correction: guess using the offset at the
 * naive instant, then re-measure the offset at the corrected instant and redo
 * the subtraction. The second pass is what keeps the result correct on
 * daylight-saving transition days.
 */
export function zonedWallClockToInstant(
  dateKey: string,
  minutesOfDay: number,
  timezone: string,
): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, 0, 0, 0) + minutesOfDay * MS_PER_MINUTE;

  const firstOffset = getTimeZoneOffsetMinutes(new Date(naive), timezone);
  const firstGuess = naive - firstOffset * MS_PER_MINUTE;

  const secondOffset = getTimeZoneOffsetMinutes(new Date(firstGuess), timezone);
  if (secondOffset === firstOffset) return new Date(firstGuess);

  const secondGuess = naive - secondOffset * MS_PER_MINUTE;
  return new Date(secondGuess);
}

/** The scheduled start instant for a `YYYY-MM-DD` work date. */
export function scheduledStartInstant(
  dateKey: string,
  schedule: Pick<WorkScheduleTimes, "startTime">,
  timezone: string,
): Date {
  return zonedWallClockToInstant(dateKey, parseTimeString(schedule.startTime), timezone);
}

/** The scheduled end instant for a `YYYY-MM-DD` work date. */
export function scheduledEndInstant(
  dateKey: string,
  schedule: Pick<WorkScheduleTimes, "endTime">,
  timezone: string,
): Date {
  return zonedWallClockToInstant(dateKey, parseTimeString(schedule.endTime), timezone);
}

export interface CheckInEvaluation {
  status: Extract<AttendanceStatus, "PRESENT" | "LATE">;
  /** Minutes past `startTime + lateToleranceMinutes`. Zero when on time. */
  lateMinutes: number;
  /** The instant the late threshold was crossed, for UI messaging. */
  thresholdInstant: Date;
}

/**
 * Decides whether a check-in is on time.
 *
 * `scheduledStart` is a wall-clock time in the organization timezone, so it is
 * resolved into a real instant before comparison. Lateness is measured from the
 * start time and only becomes reportable once the tolerance is exceeded — an
 * employee arriving four minutes late to a shift with a 10-minute tolerance is
 * PRESENT, not LATE.
 */
export function evaluateCheckIn(
  checkInAt: Date,
  workDateKey: string,
  schedule: Pick<WorkScheduleTimes, "startTime" | "lateToleranceMinutes">,
  timezone: string,
): CheckInEvaluation {
  const thresholdMinutes =
    parseTimeString(schedule.startTime) + Math.max(0, schedule.lateToleranceMinutes);
  const thresholdInstant = zonedWallClockToInstant(workDateKey, thresholdMinutes, timezone);

  const diffMinutes = Math.floor((checkInAt.getTime() - thresholdInstant.getTime()) / MS_PER_MINUTE);
  const lateMinutes = Math.max(0, diffMinutes);

  return {
    status: lateMinutes > 0 ? "LATE" : "PRESENT",
    lateMinutes,
    thresholdInstant,
  };
}

/** The wall-clock time of the late threshold, e.g. "09:10". */
export function lateThresholdClock(
  schedule: Pick<WorkScheduleTimes, "startTime" | "lateToleranceMinutes">,
): string {
  return formatTimeString(parseTimeString(schedule.startTime) + Math.max(0, schedule.lateToleranceMinutes));
}

/**
 * Elapsed minutes between check-in and check-out.
 *
 * This is the plain difference between the two instants — no scheduled break is
 * deducted. The duration shown and reported everywhere is what the employee was
 * clocked in for; deductions belong in payroll, which has more inputs than an
 * attendance record has.
 *
 * Both sides are absolute instants, so the subtraction is exact elapsed real time
 * and cannot be shifted by the UTC/WIB offset or by a DST transition.
 *
 * Returns 0 rather than a negative number when a clock anomaly would otherwise
 * produce one, so a bad timestamp can never inflate an attendance statistic. An
 * open shift also returns 0, because its duration is not known until check-out.
 */
export function calculateWorkedMinutes(checkInAt: Date | null, checkOutAt: Date | null): number {
  if (!checkInAt || !checkOutAt) return 0;
  const elapsed = Math.floor((checkOutAt.getTime() - checkInAt.getTime()) / MS_PER_MINUTE);
  return Math.max(0, elapsed);
}

/**
 * The final status once the shift is complete.
 *
 * A late arrival stays LATE even after checking out — the day was late, and
 * leaving on time does not retroactively rewrite history.
 */
export function finaliseStatus(lateMinutes: number): AttendanceStatus {
  return lateMinutes > 0 ? "LATE" : "PRESENT";
}

/** Human-readable lateness summary, e.g. "Terlambat 1 jam 12 menit". */
export function describeLateness(lateMinutes: number): string {
  if (lateMinutes <= 0) return "Tepat waktu";
  const hours = Math.floor(lateMinutes / 60);
  const minutes = lateMinutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} jam`);
  if (minutes > 0) parts.push(`${minutes} menit`);
  return `Terlambat ${parts.join(" ")}`;
}

/**
 * Whether a shift is still open, i.e. the employee may still check out.
 */
export function isShiftOpen(attendance: {
  checkInAt: Date | null;
  checkOutAt: Date | null;
}): boolean {
  return attendance.checkInAt !== null && attendance.checkOutAt === null;
}

/**
 * How far a check-in is from the scheduled start, in minutes. Negative means
 * the employee arrived early. Used to render the "arrived X early" hint.
 */
export function minutesRelativeToStart(
  checkInAt: Date,
  workDateKey: string,
  schedule: Pick<WorkScheduleTimes, "startTime">,
  timezone: string,
): number {
  const start = scheduledStartInstant(workDateKey, schedule, timezone);
  return Math.round((checkInAt.getTime() - start.getTime()) / MS_PER_MINUTE);
}