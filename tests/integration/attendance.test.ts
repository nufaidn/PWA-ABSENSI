import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  baseFixture,
  currentUser,
  db,
  resetDatabase,
  seedLocation,
  seedSchedule,
  seedSettings,
  seedUser,
  signInAs,
} from "./setup";
import { AttendanceError, checkIn, checkOut } from "@/lib/dal/attendance";
import { dateKeyToDbDate, toLocalDateKey } from "@/lib/attendance/time";

/**
 * Integration tests for the attendance flow.
 *
 * These exercise the rules that only a database can guarantee — the unique
 * constraint, transaction rollback, and the status derivation written by the
 * server clock. Pure date maths is covered by the unit suite; what is verified
 * here is that the right rows land in PostgreSQL.
 */

const TZ = "Asia/Jakarta";
const JAKARTA = { latitude: -6.2088, longitude: 106.8456 };

/** A real instant for a wall-clock time on a fixed working day (2026-10-13, Tue). */
function at(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  // WIB is a fixed +07:00 with no DST, so the UTC offset is a constant here.
  return new Date(Date.UTC(2026, 9, 13, h - 7, m, 0));
}

const workDate = dateKeyToDbDate("2026-10-13");

/** The id the mocked identity is currently signed in as. */
function currentUserId(): string {
  return currentUser.id;
}

beforeEach(async () => {
  // `seedAdmin` mutates the mocked identity's role; reset it so a test that
  // signs in as an administrator cannot leak into the next one.
  currentUser.role = "EMPLOYEE";
  await baseFixture();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("check-in", () => {
  it("writes a PRESENT record for an on-time arrival", async () => {
    const result = await checkIn({ now: at("08:55") });

    expect(result.status).toBe("PRESENT");
    expect(result.lateMinutes).toBe(0);

    const row = await db.attendance.findUnique({ where: { id: result.id } });
    expect(row).not.toBeNull();
    expect(row?.userId).toBe(currentUserId());
    expect(row?.status).toBe("PRESENT");
    // The clock is the server's, not something derived from the input shape.
    expect(row?.checkInAt?.toISOString()).toBe(at("08:55").toISOString());
  });

  it("stores workDate as a calendar date, not a zoned instant", async () => {
    const result = await checkIn({ now: at("23:30") });

    const row = await db.attendance.findUnique({ where: { id: result.id } });
    // 23:30 WIB on 2026-10-13 is 16:30 UTC on the same day.
    expect(toLocalDateKey(row!.checkInAt!, TZ)).toBe("2026-10-13");

    // `@db.Date` has no time component: it round-trips as UTC midnight of the
    // calendar date, NOT the local midnight instant (which would be 17:00Z the
    // previous day). This is the contract the unique constraint relies on — two
    // check-ins at different hours must land on the same stored value.
    expect(row?.workDate).toEqual(new Date("2026-10-13T00:00:00.000Z"));
    expect(row?.workDate.toISOString().slice(0, 10)).toBe("2026-10-13");
  });

  it("collapses every hour of a day onto one workDate value", async () => {
    // The whole point of @db.Date: 08:00 and 23:30 WIB are different instants
    // but must produce an identical stored date, or the unique constraint would
    // fail to prevent a second check-in in the evening.
    const morning = await checkIn({ now: at("08:00") });
    await db.attendance.update({ where: { id: morning.id }, data: { checkInAt: at("23:30") } });

    const row = await db.attendance.findUnique({ where: { id: morning.id } });
    expect(row?.workDate.toISOString().slice(0, 10)).toBe("2026-10-13");
  });

  it("marks an arrival past the tolerance as LATE and stores the minutes", async () => {
    const result = await checkIn({ now: at("09:30") });

    expect(result.status).toBe("LATE");
    expect(result.lateMinutes).toBeGreaterThan(0);

    const row = await db.attendance.findUnique({ where: { id: result.id } });
    expect(row?.lateMinutes).toBe(result.lateMinutes);
  });

  it("rejects a second check-in on the same day", async () => {
    await checkIn({ now: at("08:00") });

    await expect(checkIn({ now: at("09:00") })).rejects.toBeInstanceOf(AttendanceError);

    // Exactly one row, not two.
    const count = await db.attendance.count({ where: { workDate } });
    expect(count).toBe(1);
  });

  it("surfaces ALREADY_CHECKED_IN as the error code", async () => {
    await checkIn({ now: at("08:00") });

    try {
      await checkIn({ now: at("10:00") });
      expect.unreachable("second check-in should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AttendanceError);
      expect((error as AttendanceError).code).toBe("ALREADY_CHECKED_IN");
    }
  });

  it("refuses check-in on a non-working day", async () => {
    // 2026-10-17 is a Saturday.
    const saturday = new Date(Date.UTC(2026, 9, 17, 2, 0, 0));

    await expect(checkIn({ now: saturday })).rejects.toMatchObject({
      code: "NOT_A_WORKING_DAY",
    });

    expect(await db.attendance.count()).toBe(0);
  });

  it("accepts coordinates inside an active fence", async () => {
    await seedLocation({ name: "Kantor", ...JAKARTA, radiusMeters: 500 });
    const result = await checkIn({ now: at("08:55"), point: { latitude: -6.2089, longitude: 106.8457 } });

    expect(result.outsideRadius).toBe(false);
    expect(result.distanceMeters).not.toBeNull();
    expect(result.distanceMeters!).toBeLessThan(500);
  });

  it("rejects a check-in far from every fence when validation is required", async () => {
    await seedLocation({ name: "Kantor", ...JAKARTA, radiusMeters: 100 });
    await seedSettings({ requireLocationValidation: true });

    // Recreate settings because the fixture already wrote id = 1.
    await db.setting.update({ where: { id: 1 }, data: { requireLocationValidation: true } });

    await expect(
      checkIn({ now: at("08:55"), point: { latitude: -6.9175, longitude: 107.6191 } }),
    ).rejects.toMatchObject({ code: "OUTSIDE_LOCATION" });

    expect(await db.attendance.count()).toBe(0);
  });

  it("rejects a check-in with no coordinates when validation is required", async () => {
    await seedLocation({ name: "Kantor", ...JAKARTA });
    await db.setting.update({ where: { id: 1 }, data: { requireLocationValidation: true } });

    await expect(checkIn({ now: at("08:55") })).rejects.toMatchObject({
      code: "LOCATION_REQUIRED",
    });
  });

  it("allows a check-in without coordinates when validation is optional", async () => {
    await seedLocation({ name: "Kantor", ...JAKARTA });
    const result = await checkIn({ now: at("08:55") });
    expect(result.status).toBe("PRESENT");
  });
});

describe("geo-fence enforcement", () => {
  /** Roughly `metres` north of the Jakarta office point. */
  function northOf(metres: number) {
    return { latitude: JAKARTA.latitude + metres / 111_320, longitude: JAKARTA.longitude };
  }

  async function withFence(radiusMeters: number, requireValidation: boolean) {
    await seedLocation({ name: "Pabrik", ...JAKARTA, radiusMeters });
    await db.setting.update({
      where: { id: 1 },
      data: { requireLocationValidation: requireValidation },
    });
  }

  it("accepts a point inside the radius and rejects one outside", async () => {
    await withFence(500, true);

    await expect(checkIn({ now: at("08:55"), point: northOf(200) })).resolves.toMatchObject({
      outsideRadius: false,
    });

    // 2 km out with a 500 m fence: the case the radius setting exists for.
    await expect(checkIn({ now: at("08:55"), point: northOf(2000) })).rejects.toMatchObject({
      code: "OUTSIDE_LOCATION",
    });
  });

  it("rejects the check-in entirely when outside, rather than recording it", async () => {
    await withFence(500, true);
    await expect(checkIn({ now: at("08:55"), point: northOf(2000) })).rejects.toThrow();
    expect(await db.attendance.count()).toBe(0);
  });

  it("honours a tightened radius", async () => {
    // The same 300 m point: fine at 500, refused at 100.
    await withFence(500, true);
    await expect(checkIn({ now: at("08:55"), point: northOf(300) })).resolves.toBeDefined();

    await resetDatabase();
    await seedSettings({ defaultScheduleId: null });
    const schedule = await seedSchedule();
    await db.setting.update({ where: { id: 1 }, data: { defaultScheduleId: schedule.id } });
    const user = await seedUser();
    signInAs(user);
    await withFence(100, true);

    await expect(checkIn({ now: at("08:55"), point: northOf(300) })).rejects.toMatchObject({
      code: "OUTSIDE_LOCATION",
    });
  });

  it("records but permits an out-of-radius check-in when validation is off", async () => {
    await withFence(500, false);

    const result = await checkIn({ now: at("08:55"), point: northOf(2000) });
    expect(result.outsideRadius).toBe(true);

    const row = await db.attendance.findUnique({ where: { id: result.id } });
    expect(row?.outsideRadius).toBe(true);
  });

  it("accepts a point inside any one of several fences", async () => {
    await seedLocation({ name: "Pabrik", ...JAKARTA, radiusMeters: 300 });
    await seedLocation({
      name: "Gudang",
      latitude: JAKARTA.latitude + 0.05,
      longitude: JAKARTA.longitude,
      radiusMeters: 300,
    });
    await db.setting.update({ where: { id: 1 }, data: { requireLocationValidation: true } });

    // Inside the second fence only.
    const point = { latitude: JAKARTA.latitude + 0.05, longitude: JAKARTA.longitude };
    await expect(checkIn({ now: at("08:55"), point })).resolves.toBeDefined();
  });

  it("ignores an inactive fence", async () => {
    await seedLocation({ name: "Pabrik", ...JAKARTA, radiusMeters: 300, isActive: false });
    await db.setting.update({ where: { id: 1 }, data: { requireLocationValidation: true } });

    await expect(checkIn({ now: at("08:55"), point: northOf(2000) })).rejects.toMatchObject({
      code: "NO_FENCE_CONFIGURED",
    });
  });
});

describe("fail-closed when no location is configured", () => {
  it("refuses check-in when validation is on but no fence exists", async () => {
    // Previously this fell through every branch and allowed the check-in from
    // anywhere, while the settings screen claimed enforcement was active.
    await db.setting.update({ where: { id: 1 }, data: { requireLocationValidation: true } });

    await expect(checkIn({ now: at("08:55") })).rejects.toBeInstanceOf(AttendanceError);
    expect(await db.attendance.count()).toBe(0);
  });

  it("reports the missing-permission reason when no coordinates were shared", async () => {
    await db.setting.update({ where: { id: 1 }, data: { requireLocationValidation: true } });

    // With no point at all, `validateLocation` reports MISSING_COORDINATES first,
    // so the actionable message is about granting location permission rather than
    // about the empty fence list.
    await expect(checkIn({ now: at("08:55") })).rejects.toMatchObject({
      code: "LOCATION_REQUIRED",
    });
  });

  it("refuses even when coordinates are supplied", async () => {
    await db.setting.update({ where: { id: 1 }, data: { requireLocationValidation: true } });

    // This is the case that used to succeed: a real point, no fence to compare it
    // against, and the check-in was accepted from anywhere in the world.
    await expect(checkIn({ now: at("08:55"), point: JAKARTA })).rejects.toMatchObject({
      code: "NO_FENCE_CONFIGURED",
    });
    expect(await db.attendance.count()).toBe(0);
  });

  it("still allows check-in when validation is off", async () => {
    await expect(checkIn({ now: at("08:55") })).resolves.toMatchObject({
      status: "PRESENT",
    });
  });
});

describe("check-out", () => {
  it("closes the shift and stores the full elapsed duration", async () => {
    await checkIn({ now: at("09:00") });
    const result = await checkOut({ now: at("17:00") });

    // Plain elapsed time: 480 minutes. The schedule's 60-minute break is not
    // deducted — that used to report 420.
    expect(result.workedMinutes).toBe(480);

    const row = await db.attendance.findUnique({ where: { id: result.id } });
    expect(row?.checkOutAt?.toISOString()).toBe(at("17:00").toISOString());
    expect(row?.workedMinutes).toBe(480);
  });

  it("keeps a late day late after checkout", async () => {
    const inResult = await checkIn({ now: at("09:30") });
    const outResult = await checkOut({ now: at("17:00") });

    expect(inResult.status).toBe("LATE");
    expect(outResult.status).toBe("LATE");
    expect(outResult.lateMinutes).toBe(inResult.lateMinutes);
  });

  it("refuses check-out without a check-in", async () => {
    await expect(checkOut({ now: at("17:00") })).rejects.toMatchObject({
      code: "NOT_CHECKED_IN",
    });

    // Critically, it must not create a record to close.
    expect(await db.attendance.count()).toBe(0);
  });

  it("refuses a second check-out on the same day", async () => {
    await checkIn({ now: at("09:00") });
    await checkOut({ now: at("17:00") });

    await expect(checkOut({ now: at("18:00") })).rejects.toMatchObject({
      code: "ALREADY_CHECKED_OUT",
    });
  });

  it("refuses a check-out that precedes check-in", async () => {
    await checkIn({ now: at("09:00") });

    await expect(checkOut({ now: at("08:30") })).rejects.toMatchObject({
      code: "INVALID_SEQUENCE",
    });

    const row = await db.attendance.findFirst();
    expect(row?.checkOutAt).toBeNull();
  });
});

describe("the (userId, workDate) unique constraint", () => {
  it("rejects a duplicate row even when written directly, bypassing the DAL", async () => {
    const user = await seedUser();
    signInAs(user);
    await checkIn({ now: at("08:00") });

    // This is the guarantee the architecture leans on: the database refuses the
    // second row even though nothing in the DAL was consulted.
    await expect(
      db.attendance.create({
        data: {
          userId: user.id,
          workDate,
          checkInAt: at("09:00"),
          status: "PRESENT",
        },
      }),
    ).rejects.toThrow();

    expect(await db.attendance.count({ where: { userId: user.id, workDate } })).toBe(1);
  });

  it("allows one row per user on the same day but different users on the same day", async () => {
    const second = await seedUser({ email: "second@attendance.test" });
    await checkIn({ now: at("08:00") });

    signInAs(second);
    const result = await checkIn({ now: at("08:30") });

    expect(result.status).toBe("PRESENT");
    expect(await db.attendance.count({ where: { workDate } })).toBe(2);
  });

  it("allows the same user on a different day", async () => {
    await checkIn({ now: at("08:00") });
    // 2026-10-14, the next working day.
    const nextDay = new Date(Date.UTC(2026, 9, 14, 2, 0, 0));

    const result = await checkIn({ now: nextDay });
    expect(result.status).toBe("PRESENT");
    expect(await db.attendance.count({ where: { userId: currentUserId() } })).toBe(2);
  });
});

describe("personal schedule overrides the organization default", () => {
  it("uses the employee's own schedule when one is assigned", async () => {
    const schedule = await db.workSchedule.create({
      data: {
        name: "Shift Malam",
        startTime: "20:00",
        endTime: "23:00",
        lateToleranceMinutes: 0,
        breakMinutes: 0,
        isOrganizationDefault: false,
        isActive: true,
      },
    });
    const user = await seedUser({ scheduleId: schedule.id });
    signInAs(user);

    // 21:00 is late for a 20:00 start but on time for the 09:00 default.
    const result = await checkIn({ now: new Date(Date.UTC(2026, 9, 13, 14, 0, 0)) });
    expect(result.status).toBe("LATE");
  });
});

describe("administrator exemption", () => {
  it("refuses check-in and check-out for an administrator", async () => {
    currentUser.role = "SUPER_ADMIN";

    await expect(checkIn({ now: at("08:55") })).rejects.toMatchObject({
      code: "ADMIN_EXEMPT",
    });
    await expect(checkOut({ now: at("17:00") })).rejects.toMatchObject({
      code: "ADMIN_EXEMPT",
    });
  });
});
