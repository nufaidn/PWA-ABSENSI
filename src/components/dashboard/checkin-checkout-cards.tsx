"use client";

import { CheckCircle2, LogOut } from "lucide-react";
import { DESIGN_TOKENS } from "@/lib/design/tokens";

interface CheckinCheckoutCardsProps {
  checkInAt: string | null; // ISO string
  checkOutAt: string | null; // ISO string
}

/**
 * Two-card display for check-in and check-out times
 * Positioned side-by-side in hero card
 */
export function CheckinCheckoutCards({
  checkInAt,
  checkOutAt,
}: CheckinCheckoutCardsProps) {
  // Format time as HH:MM:SS
  const formatTime = (isoString: string | null) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const checkInTime = formatTime(checkInAt);
  const checkOutTime = formatTime(checkOutAt);

  const Card = ({
    icon: Icon,
    label,
    time,
    status,
    isCheckIn,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    time: string | null;
    status?: string;
    isCheckIn: boolean;
  }) => (
    <div
      style={{
        background: "white",
        padding: DESIGN_TOKENS.spacing[3],
        borderRadius: DESIGN_TOKENS.borderRadius.lg,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: DESIGN_TOKENS.spacing[2],
        flex: 1,
      }}
    >
      {/* Icon + Label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: DESIGN_TOKENS.spacing[2],
        }}
      >
        <Icon
          size={20}
          color={isCheckIn ? DESIGN_TOKENS.colors.green[600] : DESIGN_TOKENS.colors.gray[400]}
          strokeWidth={2}
        />
        <span
          style={{
            fontSize: DESIGN_TOKENS.typography.fontSize.xs,
            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
            textTransform: "uppercase",
            color: DESIGN_TOKENS.colors.gray[500],
            letterSpacing: DESIGN_TOKENS.typography.letterSpacing.wide,
          }}
        >
          {label}
        </span>
      </div>

      {/* Time or Status */}
      {time ? (
        <p
          style={{
            fontSize: "18px",
            fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
            color: DESIGN_TOKENS.colors.black,
            fontFamily: "monospace",
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          {time}
        </p>
      ) : (
        <p
          style={{
            fontSize: DESIGN_TOKENS.typography.fontSize.base,
            color: DESIGN_TOKENS.colors.gray[500],
            margin: 0,
          }}
        >
          {status || "Belum check-out"}
        </p>
      )}
    </div>
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: DESIGN_TOKENS.spacing[3],
        marginTop: DESIGN_TOKENS.spacing[4],
        paddingTop: DESIGN_TOKENS.spacing[4],
        borderTop: `1px solid rgba(255, 255, 255, 0.2)`,
      }}
    >
      <Card
        icon={CheckCircle2}
        label="CHECK-IN"
        time={checkInTime}
        isCheckIn={true}
      />
      <Card
        icon={LogOut}
        label="CHECK-OUT"
        time={checkOutTime}
        status={checkOutAt ? undefined : "Belum check-out"}
        isCheckIn={false}
      />
    </div>
  );
}
