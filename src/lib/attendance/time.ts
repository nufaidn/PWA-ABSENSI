/**
 * Timezone-aware date helpers.
 *
 * The application's concept of a "work day" is a local calendar day, so we
 * need three distinct notions:
 *   - `workDate`  : the calendar date (no time, no zone) — stored as `@db.Date`
 *   - instants    : real points in time, always stored as UTC `timestamptz`
 *   - schedules   : wall-clock times like "09:00" interpreted in the org zone
 *
 * Keeping these separate is what makes "today's attendance" unambiguous
 * regardless of the server's own timezone.
 */
import type { AttendanceStatus, Role } from "@/lib/domain";

export type { Role };

export const MINUTES_PER_DAY = 24 * 60;
export const MS_PER_MINUTE = 60_000;

export const DEFAULT_TIMEZONE = "Asia/Jakarta";

/** Days of the week indexed to match `Date.prototype.getUTCDay()` (0 = Sunday). */
export const DAY_NAMES = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
] as const;

export const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

export const WEEKDAY_INDEXES = [1, 2, 3, 4, 5] as const;

export interface WorkScheduleTimes {
  /** Wall-clock start, "HH:mm". */
  startTime: string;
  /** Wall-clock end, "HH:mm". */
  endTime: string;
  lateToleranceMinutes: number;
  breakMinutes: number;
}

export function isValidTimeString(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [h, m] = value.split(":").map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export function parseTimeString(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function formatTimeString(minutesFromMidnight: number): string {
  const total = ((Math.round(minutesFromMidnight) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Zone offset resolution
// ---------------------------------------------------------------------------

/**
 * Returns the UTC offset in minutes for `timezone` at the given instant.
 *
 * Derived from the Intl API rather than a hardcoded table so daylight-saving
 * transitions stay correct without any dependency.
 */
export function getTimeZoneOffsetMinutes(date: Date, timezone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") lookup[part.type] = part.value;
  }
  // `hour` can come back as "24" for midnight in some ICU versions.
  const hour = Number(lookup.hour) % 24;
  const asUtc = Date.UTC(
    Number(lookup.year),
    Number(lookup.month) - 1,
    Number(lookup.day),
    hour,
    Number(lookup.minute),
    Number(lookup.second),
  );
  return Math.round((asUtc - date.getTime()) / MS_PER_MINUTE);
}

export function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** The calendar date in `timezone`, expressed as `YYYY-MM-DD`. */
export function toLocalDateKey(date: Date, timezone: string): string {
  const offset = getTimeZoneOffsetMinutes(date, timezone);
  const shifted = new Date(date.getTime() + offset * MS_PER_MINUTE);
  return shifted.toISOString().slice(0, 10);
}

/** Midnight (00:00) of `dateKey` in `timezone`, as a UTC `Date`. */
export function fromLocalDateKey(dateKey: string, timezone: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  // Guess with UTC, measure the real offset at that instant, then correct once.
  // A second pass handles the case where the guess lands across a DST change.
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  let instant = new Date(guess - getTimeZoneOffsetMinutes(new Date(guess), timezone) * MS_PER_MINUTE);
  const correctedOffset = getTimeZoneOffsetMinutes(instant, timezone);
  if (correctedOffset !== getTimeZoneOffsetMinutes(new Date(guess), timezone)) {
    instant = new Date(guess - correctedOffset * MS_PER_MINUTE);
  }
  return instant;
}

/**
 * A `YYYY-MM-DD` key as a `Date` anchored to UTC midnight.
 *
 * Firestore stores `workDate` as the string key itself, so production code does
 * not need this. It remains useful for tests and for adapting legacy `Date`
 * values without accidentally shifting the calendar day.
 *
 * Passing a zoned instant here is silently wrong: `fromLocalDateKey` returns
 * 17:00Z on the *previous* day for midnight in WIB, which truncates to the
 * previous calendar date. An attendance row for 2026-10-13 would be stored as
 * 2026-10-12 — shifting every report by a day.
 */
export function dateKeyToDbDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Wall-clock minute-of-day for `date` in `timezone`. */
export function minutesOfDayInZone(date: Date, timezone: string): number {
  const offset = getTimeZoneOffsetMinutes(date, timezone);
  const shifted = new Date(date.getTime() + offset * MS_PER_MINUTE);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/** 0 = Sunday … 6 = Saturday, for `dateKey` interpreted in `timezone`. */
export function getDayOfWeekForDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isWorkingDay(dateKey: string, workingDays: readonly number[] = WEEKDAY_INDEXES): boolean {
  return workingDays.includes(getDayOfWeekForDateKey(dateKey) as never);
}

/** Adds `days` to a `YYYY-MM-DD` key, staying on calendar arithmetic. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/** Inclusive list of date keys from `from` to `to`. */
export function enumerateDateKeys(from: string, to: string): string[] {
  const keys: string[] = [];
  let cursor = from;
  // Guard against a reversed or absurd range producing an unbounded loop.
  if (from > to) return keys;
  let guard = 0;
  while (cursor <= to && guard < 3660) {
    keys.push(cursor);
    cursor = addDaysToDateKey(cursor, 1);
    guard += 1;
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const timeFormatter = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Jakarta",
});

/** Formats an instant as local `HH:mm` in `timezone`. */
export function formatClockTime(date: Date | null, timezone: string): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(date);
}

/** Formats an instant as a long local date, e.g. "Senin, 13 Oktober 2026". */
export function formatLongDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: timezone,
  }).format(date);
}

/** Formats an instant as a short local date, e.g. "13 Okt 2026". */
export function formatShortDate(date: Date | null, timezone: string): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: timezone,
  }).format(date);
}

/** Renders a `YYYY-MM-DD` key as "13 Okt 2026" without any timezone shifting. */
export function formatDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return `${d} ${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`;
}

export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0j 0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}j ${m}m`;
}

// ---------------------------------------------------------------------------
// Role hierarchy
// ---------------------------------------------------------------------------

/**
 * Privileges, not seniority.
 *
 * `INTERN` shares EMPLOYEE's rank on purpose: a magang can do exactly what a
 * regular employee can, and nothing more. Giving it a distinct number would
 * imply a privilege difference that does not exist, and would make a future
 * `hasRole(role, "EMPLOYEE")` — intended to mean "a non-privileged account" —
 * quietly exclude interns.
 *
 * The real enforcement boundary is `ADMIN`: `createEmployee` and
 * `updateEmployee` both require it, so no intern can reach role assignment.
 */
export const ROLE_RANK: Record<Role, number> = {
  EMPLOYEE: 1,
  INTERN: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export const ROLE_LABEL: Record<Role, string> = {
  EMPLOYEE: "Karyawan",
  INTERN: "Magang",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

/** Roles that sign in through the employee form and need an employee code. */
export const SELF_SERVICE_ROLES: readonly Role[] = ["EMPLOYEE", "INTERN"];

/**
 * Roles that are expected to record attendance.
 *
 * Administrators manage the system instead of clocking in, so they are
 * deliberately excluded. This happens to match `SELF_SERVICE_ROLES` today, but
 * the two answer different questions and are kept separate so a future role
 * can gain one without silently gaining the other.
 */
export const ATTENDANCE_ROLES: readonly Role[] = ["EMPLOYEE", "INTERN"];

/** True when the role is expected to check in and out. */
export function isAttendanceRole(role: Role): boolean {
  return ATTENDANCE_ROLES.includes(role);
}

/** True when `role` is at least as privileged as `required`. */
export function hasRole(role: Role, required: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

/** True when the role signs in with an employee code rather than an email. */
export function isSelfServiceRole(role: Role): boolean {
  return SELF_SERVICE_ROLES.includes(role);
}

// ---------------------------------------------------------------------------
// Attendance status presentation
// ---------------------------------------------------------------------------

export interface StatusDescriptor {
  label: string;
  /** Tailwind classes for the badge: bg + text + border. */
  className: string;
  dotClassName: string;
}

export const STATUS_DESCRIPTOR: Record<AttendanceStatus, StatusDescriptor> = {
  PRESENT: {
    label: "Hadir",
    className: "bg-success-muted text-success-foreground ring-success/25 text-[oklch(0.38_0.09_163)]",
    dotClassName: "bg-success",
  },
  LATE: {
    label: "Terlambat",
    className: "bg-warning-muted text-[oklch(0.42_0.11_76)] ring-warning/30",
    dotClassName: "bg-warning",
  },
  ABSENT: {
    label: "Alpa",
    className: "bg-destructive/10 text-destructive ring-destructive/25",
    dotClassName: "bg-destructive",
  },
  INCOMPLETE: {
    label: "Belum Check-out",
    className: "bg-info-muted text-[oklch(0.36_0.09_234)] ring-info/30",
    dotClassName: "bg-info",
  },
  LEAVE: {
    label: "Izin / Cuti",
    className: "bg-muted text-muted-foreground ring-border",
    dotClassName: "bg-muted-foreground",
  },
  HOLIDAY: {
    label: "Libur",
    className: "bg-muted text-muted-foreground ring-border",
    dotClassName: "bg-muted-foreground",
  },
};

export const TIME_FORMATTER = timeFormatter;