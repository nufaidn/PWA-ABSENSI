"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Status pill for an attendance day.
 *
 * Colour alone is never the only signal — every badge carries its text label,
 * which keeps it readable for colour-blind users and in high-contrast modes.
 */
export function StatusBadge({
  label,
  className,
  dotClassName,
}: {
  label: string;
  className?: string;
  dotClassName?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ring-inset",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dotClassName)} aria-hidden />
      {label}
    </span>
  );
}

/** Small neutral pill for roles and metadata. */
export function Chip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Thin progress meter used for attendance/punctuality percentages. */
export function ProgressMeter({
  value,
  tone = "primary",
  className,
  label,
}: {
  value: number;
  tone?: "primary" | "success" | "warning";
  className?: string;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const tones = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
  } as const;

  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", tones[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/** Monogram avatar used in the header and the admin roster. */
export function Monogram({
  name,
  className,
  size = "md",
}: {
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const sizes = {
    sm: "size-8 text-[11px]",
    md: "size-9 text-[12px]",
    lg: "size-12 text-sm",
  } as const;

  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-accent font-semibold text-primary",
        sizes[size],
        className,
      )}
    >
      {initials || "?"}
    </span>
  );
}