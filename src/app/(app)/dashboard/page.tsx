import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal/auth";
import { getTodaySummary } from "@/lib/dal/attendance";
import { formatShortDate, isAttendanceRole } from "@/lib/attendance/time";
import { AttendanceCard } from "@/components/attendance/attendance-card";

export const metadata: Metadata = {
  title: "Beranda",
};

/**
 * Employee home screen.
 *
 * Deliberately only the clock-in control and a greeting. The statistics, the
 * 30-day summary and the recent-activity list all moved out: this screen is
 * opened dozens of times a day with one intent — record attendance — and every
 * extra block pushed the button further down the fold. Trends live in
 * `/statistics` and the full record in `/attendance`, both one tap away in the
 * navigation.
 *
 * The history query is gone with them, so the page now loads in a single round
 * trip.
 */
export default async function DashboardPage() {
  const user = await requireUser();
  // Administrators manage attendance instead of recording it.
  if (!isAttendanceRole(user.role)) redirect("/admin/overview");

  const today = await getTodaySummary();

  const { attendance, schedule, timezone } = today;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-5 flex flex-col gap-1">
        <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
          {formatShortDate(today.serverNow, timezone)}
        </p>
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground sm:text-[26px]">
          Halo, {user.name.split(" ")[0]}
        </h1>
        {user.department ? (
          <p className="text-[13.5px] text-muted-foreground">{user.department}</p>
        ) : null}
      </header>

      <AttendanceCard
        data={{
          status: attendance?.status ?? null,
          checkInAt: attendance?.checkInAt?.toISOString() ?? null,
          checkOutAt: attendance?.checkOutAt?.toISOString() ?? null,
          lateMinutes: attendance?.lateMinutes ?? 0,
          workedMinutes: attendance?.workedMinutes ?? 0,
          distanceMeters: attendance?.checkInDistanceM ?? null,
          outsideRadius: attendance?.outsideRadius ?? false,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          lateToleranceMinutes: schedule.lateToleranceMinutes,
          scheduleNote: schedule.description,
          requireLocation: false,
          isWorkingDay: today.isWorkingDay,
          timezone,
          serverNow: today.serverNow.toISOString(),
          serverTimezone: timezone,
        }}
      />
    </div>
  );
}