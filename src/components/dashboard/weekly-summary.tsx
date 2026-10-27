"use client";

import { CheckCircle2, AlertCircle, Calendar } from "lucide-react";
import { DESIGN_TOKENS } from "@/lib/design/tokens";

interface WeeklySummaryProps {
  /** Total days present this week/month */
  totalHadir: number;
  /** Total days late this week/month */
  totalTerlambat: number;
  /** Total leave/permission days */
  totalIzin: number;
  /** Title for the summary (e.g., "Ringkasan bulan ini") */
  title?: string;
}

/**
 * Weekly/Monthly summary card showing attendance statistics
 * Displays: Hadir, Terlambat, Izin in 3-column grid
 */
export function WeeklySummary({
  totalHadir,
  totalTerlambat,
  totalIzin,
  title = "Ringkasan bulan ini",
}: WeeklySummaryProps) {
  const StatCard = ({
    icon: Icon,
    value,
    label,
    color,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    value: number;
    label: string;
    color: "green" | "orange" | "blue";
  }) => {
    const colors = {
      green: {
        bg: DESIGN_TOKENS.colors.green[50],
        text: DESIGN_TOKENS.colors.green[700],
        icon: DESIGN_TOKENS.colors.green[600],
      },
      orange: {
        bg: DESIGN_TOKENS.colors.orange[50],
        text: DESIGN_TOKENS.colors.orange[700],
        icon: DESIGN_TOKENS.colors.orange[600],
      },
      blue: {
        bg: DESIGN_TOKENS.colors.blue[50],
        text: DESIGN_TOKENS.colors.blue[700],
        icon: DESIGN_TOKENS.colors.blue[600],
      },
    };

    const colorScheme = colors[color];

    return (
      <div
        style={{
          background: colorScheme.bg,
          padding: DESIGN_TOKENS.spacing[3],
          borderRadius: DESIGN_TOKENS.borderRadius.lg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: DESIGN_TOKENS.spacing[2],
        }}
      >
        <div
          style={{
            width: "24px",
            height: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colorScheme.icon,
          }}
        >
          <Icon className="w-6 h-6" />
        </div>

        <p
          style={{
            fontSize: "24px",
            fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
            color: colorScheme.text,
            margin: 0,
            lineHeight: 1,
          }}
        >
          {value}
        </p>

        <p
          style={{
            fontSize: DESIGN_TOKENS.typography.fontSize.xs,
            color: DESIGN_TOKENS.colors.gray[500],
            margin: 0,
          }}
        >
          {label}
        </p>
      </div>
    );
  };

  return (
    <div
      style={{
        padding: "0",
        marginTop: DESIGN_TOKENS.spacing[4],
        marginBottom: DESIGN_TOKENS.spacing[4],
      }}
    >
      {/* Title */}
      <h2
        style={{
          fontSize: DESIGN_TOKENS.typography.fontSize.base,
          fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
          color: DESIGN_TOKENS.colors.black,
          margin: 0,
          marginBottom: DESIGN_TOKENS.spacing[3],
        }}
      >
        {title}
      </h2>

      {/* Stats Grid - 3 columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: DESIGN_TOKENS.spacing[3],
        }}
      >
        <StatCard
          icon={CheckCircle2}
          value={totalHadir}
          label="Hari hadir"
          color="green"
        />

        <StatCard
          icon={AlertCircle}
          value={totalTerlambat}
          label="Terlambat"
          color="orange"
        />

        <StatCard
          icon={Calendar}
          value={totalIzin}
          label="Izin / Cuti"
          color="blue"
        />
      </div>
    </div>
  );
}
