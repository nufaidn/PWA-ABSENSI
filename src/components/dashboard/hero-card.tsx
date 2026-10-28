"use client";

import { Lock } from "lucide-react";
import { DESIGN_TOKENS } from "@/lib/design/tokens";
import { ProgressRing } from "./progress-ring";
import { CheckinCheckoutCards } from "./checkin-checkout-cards";
import { useServerClock } from "@/lib/attendance/use-server-clock";
import type { AttendanceStatus } from "@/lib/domain";

interface HeroCardProps {
  status: AttendanceStatus | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  workedMinutes: number;
  lateMinutes: number;
  serverNow: string;
  serverTimezone: string;
  children?: React.ReactNode; // For action button
}

/**
 * Hero card component - main attendance status display
 * Shows real-time clock, progress ring, check-in/out status
 */
export function HeroCard({
  status,
  checkInAt,
  checkOutAt,
  workedMinutes,
  lateMinutes,
  serverNow,
  serverTimezone,
  children,
}: HeroCardProps) {
  // Real-time clock from server
  const clock = useServerClock(serverNow);

  // Calculate real-time worked minutes
  const getRealTimeWorkedMinutes = () => {
    // If already checked out, use stored workedMinutes
    if (checkOutAt) {
      return workedMinutes;
    }
    
    // If not checked in yet, return 0
    if (!checkInAt) {
      return 0;
    }
    
    // Calculate from checkInAt to now
    const checkInTime = new Date(checkInAt).getTime();
    const nowTime = clock;
    const elapsedMs = nowTime - checkInTime;
    const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000));
    
    return elapsedMinutes;
  };

  // Format server time as HH:MM:SS (manual format to use colon separator)
  const formatServerTime = () => {
    const date = new Date(clock);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  // Get status badge info
  const getStatusBadge = () => {
    if (status === "PRESENT") {
      return {
        label: "◯ Hadir",
        bgColor: DESIGN_TOKENS.colors.green[50],
        textColor: DESIGN_TOKENS.colors.green[700],
      };
    }
    if (status === "LATE") {
      return {
        label: "⚠ Terlambat",
        bgColor: DESIGN_TOKENS.colors.orange[50],
        textColor: DESIGN_TOKENS.colors.orange[700],
      };
    }
    if (status === "LEAVE") {
      return {
        label: "✓ Izin/Cuti",
        bgColor: DESIGN_TOKENS.colors.blue[50],
        textColor: DESIGN_TOKENS.colors.blue[700],
      };
    }
    // Default for ABSENT, INCOMPLETE, HOLIDAY, or null
    return {
      label: "○ Belum absen",
      bgColor: DESIGN_TOKENS.colors.gray[100],
      textColor: DESIGN_TOKENS.colors.gray[600],
    };
  };

  const statusBadge = getStatusBadge();
  const realTimeWorkedMinutes = getRealTimeWorkedMinutes();

  return (
    <div
      style={{
        background: DESIGN_TOKENS.gradients.heroCard,
        borderRadius: DESIGN_TOKENS.borderRadius["4xl"],
        padding: DESIGN_TOKENS.componentSizes.heroCardPadding,
        margin: `${DESIGN_TOKENS.spacing[4]}px 0`,
        boxShadow: DESIGN_TOKENS.shadows.lg,
        color: "white",
      }}
    >
      {/* Header: WAKTU SERVER + Status Badge */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: DESIGN_TOKENS.spacing[4],
        }}
      >
        <span
          style={{
            fontSize: DESIGN_TOKENS.typography.fontSize.xs,
            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
            textTransform: "uppercase",
            letterSpacing: DESIGN_TOKENS.typography.letterSpacing.wider,
            opacity: 0.9,
          }}
        >
          WAKTU SERVER
        </span>

        <span
          style={{
            fontSize: DESIGN_TOKENS.typography.fontSize.xs,
            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
            backgroundColor: statusBadge.bgColor,
            color: statusBadge.textColor,
            padding: `${DESIGN_TOKENS.spacing[1]}px ${DESIGN_TOKENS.spacing[2]}px`,
            borderRadius: DESIGN_TOKENS.borderRadius.xl,
          }}
        >
          {statusBadge.label}
        </span>
      </div>

      {/* Server Time - Large Display */}
      <p
        style={{
          fontSize: "40px",
          fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
          margin: 0,
          marginBottom: DESIGN_TOKENS.spacing[6],
          fontFamily: "monospace",
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
        suppressHydrationWarning
      >
        {formatServerTime()}
      </p>

      {/* Progress Ring Section */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: DESIGN_TOKENS.spacing[6],
          padding: `${DESIGN_TOKENS.spacing[4]}px ${DESIGN_TOKENS.spacing[3]}px`,
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          borderRadius: DESIGN_TOKENS.borderRadius["2xl"],
        }}
      >
        <ProgressRing workedMinutes={realTimeWorkedMinutes} />
      </div>

      {/* Check-in / Check-out Cards */}
      <CheckinCheckoutCards checkInAt={checkInAt} checkOutAt={checkOutAt} />

      {/* Action Button Section */}
      {children && (
        <div
          style={{
            marginTop: DESIGN_TOKENS.spacing[4],
            paddingTop: DESIGN_TOKENS.spacing[4],
            borderTop: `1px solid rgba(255, 255, 255, 0.2)`,
          }}
        >
          {children}
        </div>
      )}

      {/* Security Note */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: DESIGN_TOKENS.spacing[2],
          marginTop: DESIGN_TOKENS.spacing[3],
          fontSize: DESIGN_TOKENS.typography.fontSize.xs,
          color: "white",
          opacity: 0.8,
          textAlign: "center",
        }}
      >
        <Lock size={14} />
        <span>Waktu dicatat server, tidak bisa diubah dari perangkat</span>
      </div>
    </div>
  );
}
