import { beforeEach, describe, expect, it } from "vitest";
import {
  baseFixture,
  db,
  resetDatabase,
  seedAdmin,
  seedUser,
  signInAs,
} from "./setup";
import { getAdminOverview, getAttendanceReport, getOwnAnalytics } from "@/lib/dal/reports";
import { getLocationPolicy, getSettings } from "@/lib/dal/settings";
import { dateKeyToDbDate, toLocalDateKey } from "@/lib/attendance/time";

/**
 * Integration tests for the report layer against Firestore.
 *
 * The important part is the query shape: attendance is read by a `workDate`
 * range, users are joined in memory, and an employee's own analytics use a
 * document-id range. Those are exactly the queries that would need a composite
 * index if they were written differently, so they are worth exercising against
 * the emulator rather than only through pure unit tests.
 */

const TZ = "Asia/Jakarta";

function todayKey(): string {
  return toLocalDateKey(new Date(), TZ);
}

describe("reports DAL", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("menghitung laporan admin dari dokumen Firestore", async () => {
    const { user } = await baseFixture({ name: "Budi Santoso" });
    await seedAdmin();
    const key = todayKey();
    const checkIn = new Date();

    await db.attendance.create({
      data: {
        userId: user.id,
        workDate: dateKeyToDbDate(key),
        checkInAt: checkIn,
        checkOutAt: new Date(checkIn.getTime() + 8 * 60 * 60 * 1000),
        status: "PRESENT",
        lateMinutes: 0,
        workedMinutes: 480,
      },
    });

    const report = await getAttendanceReport({ from: key, to: key });

    expect(report.total).toBe(1);
    expect(report.rows[0]?.userName).toBe("Budi Santoso");
    expect(report.summary.present).toBe(1);
    expect(report.averageWorkedMinutes).toBe(480);
  });

  it("overview admin membaca absensi hari ini", async () => {
    const { user } = await baseFixture({ name: "Siti Nurhaliza" });
    await seedAdmin();
    const key = todayKey();

    await db.attendance.create({
      data: {
        userId: user.id,
        workDate: dateKeyToDbDate(key),
        checkInAt: new Date(),
        status: "LATE",
        lateMinutes: 12,
      },
    });

    const overview = await getAdminOverview();

    expect(overview.totals.employees).toBe(1);
    expect(overview.totals.todayLate).toBe(1);
    expect(overview.recentActivity[0]?.name).toBe("Siti Nurhaliza");
  });

  it("analitik pribadi hanya membaca absensi milik sendiri", async () => {
    const { user } = await baseFixture({ name: "Andi Wijaya" });
    const other = await seedUser({ name: "Dewi Lestari" });
    const key = todayKey();

    await db.attendance.create({
      data: {
        userId: user.id,
        workDate: dateKeyToDbDate(key),
        checkInAt: new Date(),
        status: "PRESENT",
        workedMinutes: 420,
      },
    });
    await db.attendance.create({
      data: {
        userId: other.id,
        workDate: dateKeyToDbDate(key),
        status: "ABSENT",
      },
    });

    signInAs(user);
    const analytics = await getOwnAnalytics();

    expect(analytics.summary.present).toBe(1);
    expect(analytics.summary.absent).toBe(0);
  });

  it("membaca settings dan jadwal default dari Firestore", async () => {
    const { schedule } = await baseFixture();

    const settings = await getSettings();
    const policy = await getLocationPolicy();

    expect(settings.defaultScheduleId).toBe(schedule.id);
    expect(policy.timezone).toBe(TZ);
    expect(policy.requireLocationValidation).toBe(false);
  });
});
