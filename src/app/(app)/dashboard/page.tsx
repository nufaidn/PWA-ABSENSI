import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { requireUser } from "@/lib/dal/auth";
import { getTodaySummary } from "@/lib/dal/attendance";
import { isAttendanceRole } from "@/lib/attendance/time";
import { checkOutAction } from "@/app/actions/attendance";
import { GreetingSection } from "@/components/dashboard/greeting-section";
import { HeroCard } from "@/components/dashboard/hero-card";
import { WeeklySummary } from "@/components/dashboard/weekly-summary";
import { QuickLinks } from "@/components/dashboard/quick-links";

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

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(to bottom right, #f9fafb, #eff6ff 50%, #f9fafb)" }}>
      <div style={{ maxWidth: "672px", margin: "0 auto", padding: "0" }}>
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
          {/* Action Button - Check-in or Check-out */}
          <form action={checkOutAction} style={{ width: "100%" }}>
            {attendance?.checkInAt && !attendance?.checkOutAt ? (
              // Check-out button (if checked in but not checked out)
              <Button
                type="submit"
                style={{
                  width: "100%",
                  height: "56px",
                  background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
                  color: "white",
                  fontSize: "16px",
                  fontWeight: 600,
                  borderRadius: "12px",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)",
                }}
              >
                <LogOut size={20} />
                Check-out Sekarang
              </Button>
            ) : (
              // Check-in button or disabled
              <Button
                type="button"
                style={{
                  width: "100%",
                  height: "56px",
                  background: attendance?.checkInAt ? "#D1D5DB" : "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                  color: "white",
                  fontSize: "16px",
                  fontWeight: 600,
                  borderRadius: "12px",
                  border: "none",
                  cursor: attendance?.checkInAt ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: attendance?.checkInAt ? "none" : "0 4px 12px rgba(37, 99, 235, 0.3)",
                  opacity: attendance?.checkInAt ? 0.6 : 1,
                }}
                disabled={!!attendance?.checkInAt}
              >
                Absensi hari ini selesai
              </Button>
            )}
            <input type="hidden" name="intent" value="check-out" />
          </form>
        </HeroCard>

        {/* Weekly Summary */}
        <WeeklySummary
          totalHadir={18}
          totalTerlambat={1}
          totalIzin={2}
          title="Ringkasan bulan ini"
        />

        {/* Quick Links */}
        <QuickLinks />
      </div>
    </div>
  );
}