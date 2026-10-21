/**
 * Attendance aggregation helpers — pure, so the maths behind every percentage
 * on the dashboards can be unit tested without touching the database.
 */
import type { AttendanceStatus } from "@/lib/domain";

export interface AttendanceSummary {
  totalDays: number;
  present: number;
  late: number;
  absent: number;
  incomplete: number;
  leave: number;
  holiday: number;
  totalWorkedMinutes: number;
  /** Share of worked days that were actually attended, 0–100. */
  attendanceRate: number;
  /** Share of attended days that were on time, 0–100. */
  punctualityRate: number;
}

export function emptySummary(): AttendanceSummary {
  return {
    totalDays: 0,
    present: 0,
    late: 0,
    absent: 0,
    incomplete: 0,
    leave: 0,
    holiday: 0,
    totalWorkedMinutes: 0,
    attendanceRate: 0,
    punctualityRate: 0,
  };
}

/** Minimal shape accepted from an aggregated query. */
export interface StatusGroup {
  status: AttendanceStatus;
  _count: { _all: number };
}

/**
 * Builds the summary shown on the employee and admin dashboards.
 *
 * "Attended" counts PRESENT + LATE + INCOMPLETE — an employee who checked in
 * but forgot to check out did attend. Absences are therefore the complement,
 * which keeps `attendanceRate + absenceRate == 100` whenever both denominators
 * refer to the same day count.
 */
/** Maps the status enum onto the camelCase field names used in the summary. */
const STATUS_COUNT_KEY: Record<AttendanceStatus, keyof AttendanceSummary> = {
  PRESENT: "present",
  LATE: "late",
  ABSENT: "absent",
  INCOMPLETE: "incomplete",
  LEAVE: "leave",
  HOLIDAY: "holiday",
};

export function summarizeStatuses(
  groups: readonly StatusGroup[],
  totalWorkedMinutes: number,
): AttendanceSummary {
  const summary = emptySummary();

  for (const group of groups) {
    accumulateStatus(summary, group.status, group._count._all);
  }

  summary.totalWorkedMinutes = totalWorkedMinutes;
  return finaliseSummary(summary);
}

/** Adds a grouped count into the matching summary bucket. */
export function accumulateStatus(
  summary: AttendanceSummary,
  status: AttendanceStatus,
  count: number,
): void {
  const key = STATUS_COUNT_KEY[status];
  summary[key] = (summary[key] as number) + count;
}

/** Recomputes `totalDays` and both rates from the individual status counts. */
export function finaliseSummary(summary: AttendanceSummary): AttendanceSummary {
  summary.totalDays =
    summary.present +
    summary.late +
    summary.absent +
    summary.incomplete +
    summary.leave +
    summary.holiday;
  summary.attendanceRate = attendanceRateOf(summary);
  summary.punctualityRate = punctualityRateOf(summary);
  return summary;
}

/** Share of worked days actually attended, 0–100. */
export function attendanceRateOf(summary: AttendanceSummary): number {
  const attended = summary.present + summary.late + summary.incomplete;
  const effective = attended + summary.absent;
  return effective > 0 ? Math.round((attended / effective) * 1000) / 10 : 0;
}

/** Share of attended days that were on time, 0–100. */
export function punctualityRateOf(summary: AttendanceSummary): number {
  const attended = summary.present + summary.late + summary.incomplete;
  return attended > 0 ? Math.round((summary.present / attended) * 1000) / 10 : 0;
}

/** Average worked minutes per attended day, or 0 when nothing was attended. */
export function averageWorkedMinutes(
  totalWorkedMinutes: number,
  summary: Pick<AttendanceSummary, "present" | "late" | "incomplete">,
): number {
  const attended = summary.present + summary.late + summary.incomplete;
  if (attended <= 0) return 0;
  return Math.round(totalWorkedMinutes / attended);
}

export interface DailyTrendPoint {
  dateKey: string;
  label: string;
  present: number;
  late: number;
  absent: number;
  other: number;
}

/**
 * Builds a dense, gap-free series for the attendance trend chart.
 *
 * Grouped results only contain days that have records; a chart with gaps reads
 * as missing data rather than as zero attendance, so every day in the range is
 * materialised explicitly.
 */
export function buildDailyTrend(
  fromDateKey: string,
  toDateKey: string,
  groups: readonly (StatusGroup & { workDate: Date | string })[]
): DailyTrendPoint[] {
  const byKey = new Map<string, StatusGroup[]>();

  for (const group of groups) {
    const key =
      typeof group.workDate === "string"
        ? group.workDate.slice(0, 10)
        : group.workDate.toISOString().slice(0, 10);
    const existing = byKey.get(key);
    if (existing) existing.push(group);
    else byKey.set(key, [group]);
  }

  const points: DailyTrendPoint[] = [];
  const [startY, startM, startD] = fromDateKey.split("-").map(Number);
  const [endY, endM, endD] = toDateKey.split("-").map(Number);
  const cursor = new Date(Date.UTC(startY, startM - 1, startD));
  const end = Date.UTC(endY, endM - 1, endD);

  while (cursor.getTime() <= end) {
    const key = cursor.toISOString().slice(0, 10);
    const dayGroups = byKey.get(key) ?? [];
    const point: DailyTrendPoint = { dateKey: key, label: "", present: 0, late: 0, absent: 0, other: 0 };

    for (const group of dayGroups) {
      const count = group._count._all;
      if (group.status === "PRESENT") point.present += count;
      else if (group.status === "LATE") point.late += count;
      else if (group.status === "ABSENT") point.absent += count;
      else point.other += count;
    }

    point.label = `${cursor.getUTCDate()}/${cursor.getUTCMonth() + 1}`;
    points.push(point);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return points;
}