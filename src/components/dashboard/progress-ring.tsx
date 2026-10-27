"use client";

import { DESIGN_TOKENS } from "@/lib/design/tokens";

interface ProgressRingProps {
  /** Work hours worked (in minutes, will be converted to hours) */
  workedMinutes: number;
  /** Target hours per day (default: 8) */
  targetHours?: number;
  /** Size in pixels */
  size?: number;
  /** Stroke width in pixels */
  strokeWidth?: number;
}

/**
 * Circular progress ring showing work hours vs target
 * Used in hero card to visualize daily work progress
 */
export function ProgressRing({
  workedMinutes,
  targetHours = 8,
  size = 80,
  strokeWidth = 6,
}: ProgressRingProps) {
  // Convert minutes to hours (with decimals)
  const workedHours = workedMinutes / 60;

  // Calculate percentage (capped at 100%)
  const percentage = Math.min((workedHours / targetHours) * 100, 100);

  // Format duration as "Xj Ym"
  const formatDuration = () => {
    const hours = Math.floor(workedMinutes / 60);
    const minutes = workedMinutes % 60;
    return `${hours}j ${minutes}m`;
  };

  // SVG circle calculations
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const centerX = size / 2;
  const centerY = size / 2;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: DESIGN_TOKENS.spacing[2],
      }}
    >
      {/* SVG Progress Ring */}
      <div style={{ position: "relative" }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* Background circle */}
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth={strokeWidth}
          />

          {/* Progress circle */}
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke="white"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: "stroke-dashoffset 0.3s ease",
            }}
          />
        </svg>

        {/* Percentage text in center */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: size,
            height: size,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: "24px",
              fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
              color: "white",
              textAlign: "center",
            }}
          >
            {Math.round(percentage)}%
          </span>
        </div>
      </div>

      {/* Text information */}
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontSize: DESIGN_TOKENS.typography.fontSize.base,
            color: "white",
            margin: 0,
            lineHeight: DESIGN_TOKENS.typography.lineHeight.normal,
          }}
        >
          Jam kerja hari ini
        </p>

        <p
          style={{
            fontSize: "20px",
            fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
            color: "white",
            margin: `${DESIGN_TOKENS.spacing[1]}px 0 0 0`,
            lineHeight: DESIGN_TOKENS.typography.lineHeight.tight,
          }}
        >
          {formatDuration()}
        </p>

        <p
          style={{
            fontSize: DESIGN_TOKENS.typography.fontSize.xs,
            color: "rgba(255, 255, 255, 0.9)",
            margin: `${DESIGN_TOKENS.spacing[1]}px 0 0 0`,
            lineHeight: DESIGN_TOKENS.typography.lineHeight.normal,
          }}
        >
          dari target {targetHours}jam
        </p>
      </div>
    </div>
  );
}
