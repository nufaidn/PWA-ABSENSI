import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMEZONE,
  ROLE_LABEL,
  ROLE_RANK,
  addDaysToDateKey,
  describeWorkingDays,
  enumerateDateKeys,
  formatDateKey,
  formatDuration,
  fromLocalDateKey,
  getDayOfWeekForDateKey,
  getTimeZoneOffsetMinutes,
  hasRole,
  isSelfServiceRole,
  isValidTimeString,
  isValidTimeZone,
  isWorkingDay,
  minutesOfDayInZone,
  parseTimeString,
  toLocalDateKey,
} from "@/lib/attendance/time";

describe("time strings", () => {
  it("accepts only well-formed HH:mm values", () => {
    expect(isValidTimeString("00:00")).toBe(true);
    expect(isValidTimeString("09:30")).toBe(true);
    expect(isValidTimeString("23:59")).toBe(true);
    expect(isValidTimeString("24:00")).toBe(false);
    expect(isValidTimeString("9:30")).toBe(false);
    expect(isValidTimeString("09:60")).toBe(false);
    expect(isValidTimeString("")).toBe(false);
  });

  it("converts between wall-clock strings and minutes of day", () => {
    expect(parseTimeString("00:00")).toBe(0);
    expect(parseTimeString("09:15")).toBe(555);
    expect(parseTimeString("23:59")).toBe(1439);
  });
});

describe("timezone offsets", () => {
  it("resolves the UTC offset for a zone at a given instant", () => {
    // WIB is a fixed +07:00 with no daylight saving.
    expect(getTimeZoneOffsetMinutes(new Date("2026-06-15T00:00:00Z"), DEFAULT_TIMEZONE)).toBe(420);
    expect(getTimeZoneOffsetMinutes(new Date("2026-01-15T00:00:00Z"), DEFAULT_TIMEZONE)).toBe(420);
  });

  it("tracks daylight saving where the zone observes it", () => {
    // London is UTC+1 in July and UTC+0 in January.
    expect(getTimeZoneOffsetMinutes(new Date("2026-07-01T12:00:00Z"), "Europe/London")).toBe(60);
    expect(getTimeZoneOffsetMinutes(new Date("2026-01-01T12:00:00Z"), "Europe/London")).toBe(0);
  });

  it("validates IANA zone names", () => {
    expect(isValidTimeZone("Asia/Jakarta")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("local date keys", () => {
  it("derives the calendar date in the org zone, not the server zone", () => {
    // 23:30 UTC is already the next day in WIB.
    const instant = new Date("2026-10-13T23:30:00Z");
    expect(toLocalDateKey(instant, DEFAULT_TIMEZONE)).toBe("2026-10-14");
    expect(toLocalDateKey(instant, "UTC")).toBe("2026-10-13");
  });

  it("round-trips a date key through local midnight", () => {
    for (const key of ["2026-01-01", "2026-06-30", "2026-10-13", "2026-12-31"]) {
      const midnight = fromLocalDateKey(key, DEFAULT_TIMEZONE);
      expect(toLocalDateKey(midnight, DEFAULT_TIMEZONE)).toBe(key);
    }
  });

  it("resolves local midnight to midnight in the zone", () => {
    const midnight = fromLocalDateKey("2026-10-13", DEFAULT_TIMEZONE);
    // WIB midnight is 17:00 UTC on the previous day.
    expect(midnight.toISOString()).toBe("2026-10-12T17:00:00.000Z");
    expect(minutesOfDayInZone(midnight, DEFAULT_TIMEZONE)).toBe(0);
  });

  it("computes wall-clock minutes of day", () => {
    expect(minutesOfDayInZone(new Date("2026-10-13T03:00:00Z"), DEFAULT_TIMEZONE)).toBe(600);
  });
});

describe("calendar arithmetic", () => {
  it("maps date keys to a weekday index", () => {
    expect(getDayOfWeekForDateKey("2026-10-11")).toBe(0); // Sunday
    expect(getDayOfWeekForDateKey("2026-10-12")).toBe(1); // Monday
    expect(getDayOfWeekForDateKey("2026-10-17")).toBe(6); // Saturday
  });

  it("treats Monday–Friday as working days by default", () => {
    expect(isWorkingDay("2026-10-12")).toBe(true);
    expect(isWorkingDay("2026-10-16")).toBe(true);
    expect(isWorkingDay("2026-10-11")).toBe(false);
    expect(isWorkingDay("2026-10-17")).toBe(false);
  });

  it("honours a custom working-day set", () => {
    expect(isWorkingDay("2026-10-11", [0, 6])).toBe(true);
    expect(isWorkingDay("2026-10-12", [0, 6])).toBe(false);
  });

  it("describes a contiguous week as a range", () => {
    expect(describeWorkingDays([1, 2, 3, 4, 5])).toBe("Senin–Jumat");
    expect(describeWorkingDays([1, 2, 3, 4, 5, 6])).toBe("Senin–Sabtu");
    expect(describeWorkingDays([0])).toBe("Min");
  });

  it("lists the day names when the week has a gap", () => {
    expect(describeWorkingDays([1, 3, 5])).toBe("Sen, Rab, Jum");
    expect(describeWorkingDays([])).toBe("Belum ada hari kerja");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDaysToDateKey("2026-10-13", 1)).toBe("2026-10-14");
    expect(addDaysToDateKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToDateKey("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDaysToDateKey("2028-02-28", 1)).toBe("2028-02-29"); // leap year
    expect(addDaysToDateKey("2026-10-13", 0)).toBe("2026-10-13");
  });

  it("enumerates an inclusive date range", () => {
    expect(enumerateDateKeys("2026-10-12", "2026-10-14")).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
    ]);
    expect(enumerateDateKeys("2026-10-14", "2026-10-14")).toEqual(["2026-10-14"]);
  });

  it("returns nothing for a reversed range instead of looping", () => {
    expect(enumerateDateKeys("2026-10-14", "2026-10-12")).toEqual([]);
  });
});

describe("formatting", () => {
  it("renders a date key without any timezone shifting", () => {
    expect(formatDateKey("2026-10-13")).toBe("13 Okt 2026");
    expect(formatDateKey("2026-01-05")).toBe("5 Jan 2026");
  });

  it("returns the key unchanged when it cannot be parsed", () => {
    expect(formatDateKey("bukan-tanggal")).toBe("bukan-tanggal");
  });

  it("formats durations and clamps non-positive values", () => {
    expect(formatDuration(0)).toBe("0j 0m");
    expect(formatDuration(-30)).toBe("0j 0m");
    expect(formatDuration(45)).toBe("0j 45m");
    expect(formatDuration(60)).toBe("1j 0m");
    expect(formatDuration(435)).toBe("7j 15m");
  });
});

describe("role hierarchy", () => {
  it("grants a role every privilege of the ranks below it", () => {
    expect(hasRole("ADMIN", "EMPLOYEE")).toBe(true);
    expect(hasRole("EMPLOYEE", "ADMIN")).toBe(false);
  });

  it("treats a role as satisfying its own requirement", () => {
    expect(hasRole("ADMIN", "ADMIN")).toBe(true);
  });

  it("keeps an intern out of the admin area", () => {
    expect(hasRole("INTERN", "ADMIN")).toBe(false);
  });

  it("ranks an intern alongside an employee, not below it", () => {
    // Deliberate: an intern has no privilege a regular employee lacks, so a
    // distinct number would misrepresent the access model — and would make
    // `hasRole(role, "EMPLOYEE")`, meaning "a non-admin account", silently
    // exclude interns from every employee screen.
    expect(ROLE_RANK.INTERN).toBe(ROLE_RANK.EMPLOYEE);
  });

  it("treats interns and employees alike for employee-code sign-in", () => {
    expect(isSelfServiceRole("EMPLOYEE")).toBe(true);
    expect(isSelfServiceRole("INTERN")).toBe(true);
    expect(isSelfServiceRole("ADMIN")).toBe(false);
  });

  it("gives every role a display label", () => {
    expect(ROLE_LABEL.INTERN).toBe("Magang");
    expect(Object.keys(ROLE_LABEL).sort()).toEqual(["ADMIN", "EMPLOYEE", "INTERN"].sort());
  });
});