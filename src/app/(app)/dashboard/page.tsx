import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal/auth";
import { getTodaySummary, getOwnHistory } from "@/lib/dal/attendance";
import { isAttendanceRole } from "@/lib/attendance/time";
import { GreetingSection } from "@/components/dashboard/greeting-section";
import { HeroCard } from "@/components/dashboard/hero-card";
import { WeeklySummary } from "@/components/dashboard/weekly-summary";
import { QuickLinks } from "@/components/dashboard/quick-links";
import { CheckoutButton } from "@/components/dashboard/checkout-button";

export const metadata: Metadata = {
  title: "Beranda",
};

/**
 * Dashboard Home Page - Redesigned with new Hero Card component
 * Shows real-time clock, attendance status, work progress, and quick links
 */
export default async function DashboardPage() {
  const user = await requireUser();
  if (!isAttendanceRole(user.role)) redirect("/admin/overview");

  const today = await getTodaySummary();
  const { attendance, schedule, timezone } = today;

  // Get this month's summary
  const now = today.serverNow;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const monthlySummary = await getOwnHistory({
    page: 1,
    pageSize: 1000, // Get all records for the month
    from: monthStart,
    to: monthEnd,
  });

  const { present, late, leave, incomplete } = monthlySummary.summary;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(to bottom right, #f9fafb, #eff6ff 50%, #f9fafb)" }}>
      <div style={{ maxWidth: "672px", margin: "0 auto", padding: "0 16px", paddingBottom: "100px", width: "100%" }}>
        {/* Greeting Section */}
        <GreetingSection
          name={user.name}
          department={user.department}
          date={today.serverNow}
          timezone={timezone}
        />

        {/* Hero Card with Clock, Progress, Check-in/out */}
        <HeroCard
          status={attendance?.status ?? null}
          checkInAt={attendance?.checkInAt?.toISOString() ?? null}
          checkOutAt={attendance?.checkOutAt?.toISOString() ?? null}
          workedMinutes={attendance?.workedMinutes ?? 0}
          lateMinutes={attendance?.lateMinutes ?? 0}
          serverNow={today.serverNow.toISOString()}
          serverTimezone={timezone}
        >
          <CheckoutButton
            isCheckedIn={!!attendance?.checkInAt}
            isCheckedOut={!!attendance?.checkOutAt}
          />
        </HeroCard>

        {/* Weekly Summary */}
        <WeeklySummary
          totalHadir={present}
          totalTerlambat={late}
          totalIzin={leave + incomplete}
          title="Ringkasan bulan ini"
        />

        {/* Quick Links */}
        <QuickLinks />
      </div>
    </div>
  );
}
