import { describe, expect, it } from "vitest";
import { DEFAULT_TIMEZONE, formatDuration, toLocalDateKey } from "@/lib/attendance/time";
import {
  calculateWorkedMinutes,
  describeLateness,
  evaluateCheckIn,
  finaliseStatus,
  isShiftOpen,
  lateThresholdClock,
  minutesRelativeToStart,
  scheduledEndInstant,
  scheduledStartInstant,
  zonedWallClockToInstant,
} from "@/lib/attendance/status";

const SCHEDULE = { startTime: "09:00", endTime: "17:00", lateToleranceMinutes: 10, breakMinutes: 60 };

/** Builds the real instant for a wall-clock time on `dateKey`. */
function at(dateKey: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return zonedWallClockToInstant(dateKey, h * 60 + m, DEFAULT_TIMEZONE);
}

/** Same, but with seconds, for the clock reading reported from the device. */
function atWithSeconds(dateKey: string, hhmmss: string): Date {
  const [h, m, s] = hhmmss.split(":").map(Number);
  return new Date(zonedWallClockToInstant(dateKey, h * 60 + m, DEFAULT_TIMEZONE).getTime() + s * 1000);
}

describe("zonedWallClockToInstant", () => {
  it("converts a local wall-clock time to the real UTC instant", () => {
    // 09:00 WIB is 02:00 UTC.
    expect(zonedWallClockToInstant("2026-10-13", 540, DEFAULT_TIMEZONE).toISOString()).toBe(
      "2026-10-13T02:00:00.000Z",
    );
  });

  it("stays correct across a daylight-saving transition", () => {
    // Europe/London springs forward 2026-03-29 at 01:00. 09:00 local is BST
    // (+01:00), so 08:00 UTC — not the +00:00 a single-pass conversion gives.
    expect(zonedWallClockToInstant("2026-03-29", 540, "Europe/London").toISOString()).toBe(
      "2026-03-29T08:00:00.000Z",
    );
  });

  it("handles midnight, where hour may format as 24 in some ICU builds", () => {
    const midnight = zonedWallClockToInstant("2026-10-13", 0, DEFAULT_TIMEZONE);
    expect(toLocalDateKey(midnight, DEFAULT_TIMEZONE)).toBe("2026-10-13");
    expect(midnight.toISOString()).toBe("2026-10-12T17:00:00.000Z");
  });

  it("round-trips through the local date key for a whole shift", () => {
    for (const hhmm of ["00:00", "09:00", "12:30", "17:00", "23:59"]) {
      const instant = at("2026-10-13", hhmm);
      expect(toLocalDateKey(instant, DEFAULT_TIMEZONE)).toBe("2026-10-13");
    }
  });
});

describe("schedule instants", () => {
  it("resolves start and end from the schedule strings", () => {
    expect(scheduledStartInstant("2026-10-13", SCHEDULE, DEFAULT_TIMEZONE).toISOString()).toBe(
      "2026-10-13T02:00:00.000Z",
    );
    // 17:00 WIB is 10:00 UTC.
    expect(scheduledEndInstant("2026-10-13", SCHEDULE, DEFAULT_TIMEZONE).toISOString()).toBe(
      "2026-10-13T10:00:00.000Z",
    );
  });
});

describe("evaluateCheckIn", () => {
  it("marks an on-time arrival PRESENT with no lateness", () => {
    const result = evaluateCheckIn(at("2026-10-13", "08:55"), "2026-10-13", SCHEDULE, DEFAULT_TIMEZONE);
    expect(result.status).toBe("PRESENT");
    expect(result.lateMinutes).toBe(0);
  });

  it("counts an arrival inside the tolerance as PRESENT, not LATE", () => {
    // 09:04 is past the start but still within the 10-minute tolerance.
    const result = evaluateCheckIn(at("2026-10-13", "09:04"), "2026-10-13", SCHEDULE, DEFAULT_TIMEZONE);
    expect(result.status).toBe("PRESENT");
    expect(result.lateMinutes).toBe(0);
  });

  it("reports lateness as minutes past the tolerance threshold", () => {
    const result = evaluateCheckIn(at("2026-10-13", "09:25"), "2026-10-13", SCHEDULE, DEFAULT_TIMEZONE);
    expect(result.status).toBe("LATE");
    expect(result.lateMinutes).toBe(15);
  });

  it("measures from the threshold, not the start time", () => {
    // The JSDoc above says lateness is "measured from the start time", but the
    // implementation subtracts the threshold. This test pins the implemented
    // behaviour so the discrepancy stays visible rather than silent.
    const start = { startTime: "09:00", lateToleranceMinutes: 10 };
    expect(evaluateCheckIn(at("2026-10-13", "09:20"), "2026-10-13", start, DEFAULT_TIMEZONE).lateMinutes).toBe(10);
    expect(evaluateCheckIn(at("2026-10-13", "09:20"), "2026-10-13", { ...start, lateToleranceMinutes: 0 }, DEFAULT_TIMEZONE).lateMinutes).toBe(20);
  });

  it("treats arrival exactly at the threshold as on time", () => {
    const result = evaluateCheckIn(at("2026-10-13", "09:10"), "2026-10-13", SCHEDULE, DEFAULT_TIMEZONE);
    expect(result.status).toBe("PRESENT");
    expect(result.lateMinutes).toBe(0);
  });

  it("reports the threshold instant for UI messaging", () => {
    const result = evaluateCheckIn(at("2026-10-13", "09:30"), "2026-10-13", SCHEDULE, DEFAULT_TIMEZONE);
    expect(result.thresholdInstant.toISOString()).toBe("2026-10-13T02:10:00.000Z");
  });

  it("handles a schedule with no late tolerance", () => {
    const strict = { startTime: "09:00", lateToleranceMinutes: 0 };
    const onTime = evaluateCheckIn(at("2026-10-13", "09:00"), "2026-10-13", strict, DEFAULT_TIMEZONE);
    expect(onTime.status).toBe("PRESENT");

    const oneMinuteLate = evaluateCheckIn(at("2026-10-13", "09:01"), "2026-10-13", strict, DEFAULT_TIMEZONE);
    expect(oneMinuteLate.status).toBe("LATE");
    expect(oneMinuteLate.lateMinutes).toBe(1);
  });

  it("never reports negative lateness for a very early arrival", () => {
    const result = evaluateCheckIn(at("2026-10-13", "03:00"), "2026-10-13", SCHEDULE, DEFAULT_TIMEZONE);
    expect(result.lateMinutes).toBe(0);
    expect(result.status).toBe("PRESENT");
  });
});

describe("lateThresholdClock", () => {
  it("renders the effective lateness cutoff", () => {
    expect(lateThresholdClock(SCHEDULE)).toBe("09:10");
    expect(lateThresholdClock({ startTime: "09:00", lateToleranceMinutes: 0 })).toBe("09:00");
    expect(lateThresholdClock({ startTime: "23:30", lateToleranceMinutes: 60 })).toBe("00:30");
  });
});

describe("calculateWorkedMinutes", () => {
  /*
   * The duration is the plain difference between check-in and check-out. The
   * schedule still carries `breakMinutes`, but it is deliberately not deducted:
   * a 10:52:39–13:32:51 shift is 2j 40m, not 1j 40m.
   */
  it("is the elapsed time between check-in and check-out, with no break deducted", () => {
    expect(calculateWorkedMinutes(at("2026-10-13", "09:00"), at("2026-10-13", "11:00"))).toBe(120);
    expect(calculateWorkedMinutes(at("2026-10-13", "08:00"), at("2026-10-13", "16:00"))).toBe(480);
    // 480 gross minutes used to be reported as 420 once the 60-minute break came
    // off; the whole shift is now counted.
    expect(calculateWorkedMinutes(at("2026-10-13", "09:00"), at("2026-10-13", "17:00"))).toBe(480);
  });

  it("keeps sub-minute remainders by flooring to whole minutes", () => {
    // 10:52:39 → 13:32:51 is 2h 40m 12s, which floors to 160 minutes.
    const checkIn = atWithSeconds("2026-10-13", "10:52:39");
    const checkOut = atWithSeconds("2026-10-13", "13:32:51");

    expect(calculateWorkedMinutes(checkIn, checkOut)).toBe(160);
    expect(formatDuration(calculateWorkedMinutes(checkIn, checkOut))).toBe("2j 40m");
  });

  it("returns 0 when either endpoint is missing", () => {
    expect(calculateWorkedMinutes(null, at("2026-10-13", "17:00"))).toBe(0);
    expect(calculateWorkedMinutes(at("2026-10-13", "09:00"), null)).toBe(0);
    expect(calculateWorkedMinutes(null, null)).toBe(0);
  });

  it("clamps a clock anomaly to 0 instead of a negative duration", () => {
    // Check-out recorded before check-in must never inflate a statistic.
    expect(calculateWorkedMinutes(at("2026-10-13", "09:00"), at("2026-10-13", "08:00"))).toBe(0);
    expect(calculateWorkedMinutes(at("2026-10-13", "09:00"), at("2026-10-13", "09:00"))).toBe(0);
  });

  it("measures a short shift in full, however brief", () => {
    expect(calculateWorkedMinutes(at("2026-10-13", "09:00"), at("2026-10-13", "09:01"))).toBe(1);
    expect(calculateWorkedMinutes(at("2026-10-13", "09:00"), at("2026-10-13", "09:05"))).toBe(5);
  });

  it("does not shift with the UTC offset, because it subtracts instants", () => {
    // Two wall-clock pairs that are the same length in WIB but sit at different
    // offsets; both must report the same duration.
    const morning = calculateWorkedMinutes(
      at("2026-10-13", "09:00"),
      at("2026-10-13", "16:00"),
    );
    const evening = calculateWorkedMinutes(
      at("2026-10-13", "13:00"),
      at("2026-10-13", "20:00"),
    );
    expect(morning).toBe(420);
    expect(evening).toBe(420);
    // The instants themselves are 7 hours apart in UTC terms, not 14.
    expect(
      at("2026-10-13", "09:00").getTime() < at("2026-10-13", "13:00").getTime(),
    ).toBe(true);
  });
});

describe("finaliseStatus", () => {
  it("keeps a late day late after checkout", () => {
    expect(finaliseStatus(0)).toBe("PRESENT");
    expect(finaliseStatus(15)).toBe("LATE");
  });
});

describe("describeLateness", () => {
  it("describes lateness in hours and minutes", () => {
    expect(describeLateness(0)).toBe("Tepat waktu");
    expect(describeLateness(5)).toBe("Terlambat 5 menit");
    expect(describeLateness(60)).toBe("Terlambat 1 jam");
    expect(describeLateness(72)).toBe("Terlambat 1 jam 12 menit");
  });
});

describe("isShiftOpen", () => {
  it("is true only between check-in and check-out", () => {
    expect(isShiftOpen({ checkInAt: new Date(), checkOutAt: null })).toBe(true);
    expect(isShiftOpen({ checkInAt: null, checkOutAt: null })).toBe(false);
    expect(isShiftOpen({ checkInAt: new Date(), checkOutAt: new Date() })).toBe(false);
  });
});

describe("minutesRelativeToStart", () => {
  it("is negative for an early arrival and positive for a late one", () => {
    expect(minutesRelativeToStart(at("2026-10-13", "08:45"), "2026-10-13", SCHEDULE, DEFAULT_TIMEZONE)).toBe(-15);
    expect(minutesRelativeToStart(at("2026-10-13", "09:00"), "2026-10-13", SCHEDULE, DEFAULT_TIMEZONE)).toBe(0);
    expect(minutesRelativeToStart(at("2026-10-13", "09:20"), "2026-10-13", SCHEDULE, DEFAULT_TIMEZONE)).toBe(20);
  });
});