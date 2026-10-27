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
  const clock = useServerClock(serverNow, serverTimezone);

  // Format server time as HH:MM:SS
  const formatServerTime = () => {
    return clock.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  // Get status badge info
  const getStatusBadge = () => {
    const badges = {
      ON_TIME: {
        label: "◯ Hadir",
        bgColor: DESIGN_TOKENS.colors.green[50],
        textColor: DESIGN_TOKENS.colors.green[700],
      },
      LATE: {
        label: "⚠ Terlambat",
        bgColor: DESIGN_TOKENS.colors.orange[50],
        textColor: DESIGN_TOKENS.colors.orange[700],
      },
      NOT_PRESENT: {
        label: "○ Belum absen",
        bgColor: DESIGN_TOKENS.colors.gray[100],
        textColor: DESIGN_TOKENS.colors.gray[600],
      },
    };
    return badges[status || "NOT_PRESENT"];
  };

  const statusBadge = getStatusBadge();

  return (
    <div
      style={{
        background: DESIGN_TOKENS.gradients.heroCard,
        borderRadius: DESIGN_TOKENS.borderRadius["4xl"],
        padding: DESIGN_TOKENS.componentSizes.heroCardPadding,
        margin: `0 ${DESIGN_TOKENS.spacing[4]}px ${DESIGN_TOKENS.spacing[4]}px`,
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
        <ProgressRing workedMinutes={workedMinutes} />
      </div>

      {/* Check-in / Check-out Cards */}
      <CheckinCheckoutCards checkInAt={checkInAt} checkOutAt={checkOutAt} />

      {/* Action Button Section */}
      <div
        style={{
          marginTop: DESIGN_TOKENS.spacing[4],
        }}
      >
        {children}
      </div>

      {/* Security Note */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: DESIGN_TOKENS.spacing[2],
          marginTop: DESIGN_TOKENS.spacing[3],
          fontSize: DESIGN_TOKENS.typography.fontSize.xs,
          color: DESIGN_TOKENS.colors.gray[500],
          textAlign: "center",
        }}
      >
        <Lock size={14} />
        <span>Waktu dicatat server, tidak bisa diubah dari perangkat</span>
      </div>
    </div>
  );
}
