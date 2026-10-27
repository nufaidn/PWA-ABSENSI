"use client";

import { DESIGN_TOKENS } from "@/lib/design/tokens";

interface GreetingSectionProps {
  name: string;
  department?: string | null;
  date: Date;
  timezone: string;
}

/**
 * Greeting section component showing:
 * - Dynamic greeting based on time (Selamat pagi/siang/malam)
 * - Current date in format "HARI, DD MMM YYYY"
 * - Department/division
 */
export function GreetingSection({
  name,
  department,
  date,
  timezone,
}: GreetingSectionProps) {
  // Get first name only
  const firstName = name.split(" ")[0];

  // Determine greeting based on time of day
  const getGreeting = () => {
    const hour = date.getHours();
    if (hour < 11) return "Selamat pagi";
    if (hour < 15) return "Selamat siang";
    if (hour < 18) return "Selamat sore";
    return "Selamat malam";
  };

  // Format date as "SELASA, 27 OKT 2026"
  const formatDate = () => {
    const days = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
    const months = [
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MEI",
      "JUN",
      "JUL",
      "AGS",
      "SEP",
      "OKT",
      "NOV",
      "DES",
    ];

    const dayName = days[date.getDay()];
    const day = String(date.getDate()).padStart(2, "0");
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${dayName}, ${day} ${month} ${year}`;
  };

  const greeting = getGreeting();
  const formattedDate = formatDate();

  return (
    <div
      style={{
        padding: `${DESIGN_TOKENS.spacing[4]}px 0`,
      }}
    >
      {/* Date */}
      <p
        style={{
          fontSize: DESIGN_TOKENS.typography.fontSize.xs,
          fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
          color: DESIGN_TOKENS.colors.gray[500],
          textTransform: "uppercase",
          letterSpacing: DESIGN_TOKENS.typography.letterSpacing.wider,
          marginBottom: DESIGN_TOKENS.spacing[2],
        }}
      >
        {formattedDate}
      </p>

      {/* Greeting with name in blue */}
      <h1
        style={{
          fontSize: DESIGN_TOKENS.typography.fontSize["4xl"],
          fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
          color: DESIGN_TOKENS.colors.black,
          lineHeight: DESIGN_TOKENS.typography.lineHeight.tight,
          marginBottom: DESIGN_TOKENS.spacing[1],
        }}
      >
        {greeting},{" "}
        <span style={{ color: DESIGN_TOKENS.colors.blue[600] }}>{firstName}</span>
      </h1>

      {/* Department */}
      {department && (
        <p
          style={{
            fontSize: DESIGN_TOKENS.typography.fontSize.base,
            color: DESIGN_TOKENS.colors.gray[500],
            marginTop: DESIGN_TOKENS.spacing[1],
          }}
        >
          {department}
        </p>
      )}
    </div>
  );
}
