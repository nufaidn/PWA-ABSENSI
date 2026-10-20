import { describe, expect, it } from "vitest";
import {
  attendanceRateOf,
  averageWorkedMinutes,
  buildDailyTrend,
  emptySummary,
  finaliseSummary,
  punctualityRateOf,
  summarizeStatuses,
  type AttendanceSummary,
  type StatusGroup,
} from "@/lib/attendance/summary";
import type { AttendanceStatus } from "@/generated/prisma/enums";

function group(status: AttendanceStatus, count: number): StatusGroup {
  return { status, _count: { _all: count } };
}

describe("emptySummary", () => {
  it("starts at zero with no rates", () => {
    const summary = emptySummary();
    expect(summary.totalDays).toBe(0);
    expect(summary.attendanceRate).toBe(0);
    expect(summary.punctualityRate).toBe(0);
    expect(summary.totalWorkedMinutes).toBe(0);
  });
});

describe("summarizeStatuses", () => {
  it("buckets grouped counts by status", () => {
    const summary = summarizeStatuses(
      [group("PRESENT", 10), group("LATE", 3), group("ABSENT", 2), group("LEAVE", 1), group("HOLIDAY", 4)],
      5_400,
    );

    expect(summary.present).toBe(10);
    expect(summary.late).toBe(3);
    expect(summary.absent).toBe(2);
    expect(summary.leave).toBe(1);
    expect(summary.holiday).toBe(4);
    expect(summary.totalDays).toBe(20);
    expect(summary.totalWorkedMinutes).toBe(5_400);
  });

  it("counts an employee who forgot to check out as attended", () => {
    const summary = summarizeStatuses([group("PRESENT", 5), group("INCOMPLETE", 1), group("ABSENT", 1)], 0);
    // 6 attended of 7 effective days.
    expect(summary.attendanceRate).toBe(85.7);
  });

  it("returns zeroed rates for an empty result set", () => {
    const summary = summarizeStatuses([], 0);
    expect(summary.totalDays).toBe(0);
    expect(summary.attendanceRate).toBe(0);
    expect(summary.punctualityRate).toBe(0);
  });

  it("does not divide by zero when only leave and holiday exist", () => {
    const summary = summarizeStatuses([group("LEAVE", 3), group("HOLIDAY", 2)], 0);
    expect(summary.attendanceRate).toBe(0);
    expect(summary.punctualityRate).toBe(0);
  });
});

describe("attendanceRateOf", () => {
  it("excludes leave and holiday from the denominator", () => {
    const summary: AttendanceSummary = {
      ...emptySummary(),
      present: 8,
      absent: 2,
      leave: 5,
      holiday: 5,
    };
    expect(attendanceRateOf(summary)).toBe(80);
  });

  it("keeps attendance and absence rates complementary", () => {
    const summary: AttendanceSummary = { ...emptySummary(), present: 6, late: 2, incomplete: 1, absent: 3 };
    const absenceRate = Math.round((summary.absent / (summary.absent + 9)) * 100);
    expect(attendanceRateOf(summary) + absenceRate).toBe(100);
  });

  it("rounds to one decimal place", () => {
    const summary: AttendanceSummary = { ...emptySummary(), present: 1, late: 1, absent: 1 };
    expect(attendanceRateOf(summary)).toBe(66.7);
  });
});

describe("punctualityRateOf", () => {
  it("measures on-time days against attended days", () => {
    const summary: AttendanceSummary = { ...emptySummary(), present: 7, late: 2, incomplete: 1 };
    expect(punctualityRateOf(summary)).toBe(70);
  });

  it("is 0 when nobody attended", () => {
    expect(punctualityRateOf({ ...emptySummary(), absent: 5 })).toBe(0);
  });
});

describe("averageWorkedMinutes", () => {
  it("divides total worked minutes by attended days", () => {
    const summary = { present: 8, late: 2, incomplete: 0 };
    expect(averageWorkedMinutes(4_200, summary)).toBe(420);
  });

  it("returns 0 when nothing was attended", () => {
    expect(averageWorkedMinutes(4_200, { present: 0, late: 0, incomplete: 0 })).toBe(0);
  });
});

describe("finaliseSummary", () => {
  it("recomputes totals and rates in place", () => {
    const summary: AttendanceSummary = { ...emptySummary(), present: 3, late: 1 };
    const result = finaliseSummary(summary);
    expect(result).toBe(summary);
    expect(result.totalDays).toBe(4);
    expect(result.attendanceRate).toBe(100);
    expect(result.punctualityRate).toBe(75);
  });
});

describe("buildDailyTrend", () => {
  const groups = [
    { ...group("PRESENT", 5), workDate: new Date("2026-10-12T00:00:00Z") },
    { ...group("LATE", 2), workDate: new Date("2026-10-12T00:00:00Z") },
    { ...group("ABSENT", 1), workDate: new Date("2026-10-13T00:00:00Z") },
  ];

  it("materialises a point for every day in the range", () => {
    const points = buildDailyTrend("2026-10-12", "2026-10-15", groups);
    expect(points.map((point) => point.dateKey)).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
    ]);
  });

  it("fills days with no records as zero rather than leaving gaps", () => {
    const points = buildDailyTrend("2026-10-12", "2026-10-14", groups);
    const gap = points.find((point) => point.dateKey === "2026-10-14");
    expect(gap).toMatchObject({ present: 0, late: 0, absent: 0, other: 0 });
  });

  it("splits each day's counts by status", () => {
    const points = buildDailyTrend("2026-10-12", "2026-10-13", groups);
    expect(points[0]).toMatchObject({ present: 5, late: 2, absent: 0 });
    expect(points[1]).toMatchObject({ present: 0, late: 0, absent: 1 });
  });

  it("groups statuses that are not present, late or absent into other", () => {
    const points = buildDailyTrend(
      "2026-10-12",
      "2026-10-12",
      [
        { ...group("LEAVE", 3), workDate: new Date("2026-10-12T00:00:00Z") },
        { ...group("HOLIDAY", 4), workDate: new Date("2026-10-12T00:00:00Z") },
      ],
    );
    expect(points[0].other).toBe(7);
  });

  it("labels each point with a day/month string", () => {
    const points = buildDailyTrend("2026-10-01", "2026-10-02", []);
    expect(points.map((point) => point.label)).toEqual(["1/10", "2/10"]);
  });

  it("returns a single point for a one-day range", () => {
    expect(buildDailyTrend("2026-10-12", "2026-10-12", [])).toHaveLength(1);
  });
});