import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared hero header for every administrator screen.
 *
 * Before this, each admin page opened with a bare `<h1>` and a paragraph, so the
 * six screens read as one long anonymous document. The hero gives each screen a
 * brand-tinted anchor, an icon that identifies the section at a glance, and a
 * row of computed facts (counts, ranges, policy state) that previously forced a
 * scroll before the operator knew what they were looking at.
 *
 * Server-renderable on purpose: callers pass a lucide icon component and plain
 * nodes, which keeps icons out of the client bundle and avoids the
 * "functions cannot cross the Server→Client boundary" failure that a
 * `"use client"` marker here would cause.
 */

const FACT_TONES = {
  neutral: "border-border bg-background/80 text-foreground",
  primary: "border-primary/25 bg-primary/8 text-primary",
  success: "border-success/30 bg-success-muted/80 text-[oklch(0.34_0.08_163)]",
  warning: "border-warning/35 bg-warning-muted/80 text-[oklch(0.42_0.11_76)]",
  danger: "border-destructive/25 bg-destructive/8 text-destructive",
} as const;

export type AdminFactTone = keyof typeof FACT_TONES;

export function AdminFact({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  tone?: AdminFactTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] leading-none",
        FACT_TONES[tone],
      )}
    >
      {Icon ? <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden /> : null}
      <span className="opacity-75">{label}</span>
      <span className="min-w-0 max-w-[18rem] truncate font-semibold tabular">{value}</span>
    </span>
  );
}

export function AdminHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  meta,
  actions,
}: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="relative isolate mb-5 overflow-hidden rounded-2xl border border-border bg-card surface-elevated sm:mb-6">
      <span aria-hidden className="pointer-events-none absolute inset-0 brand-wash" />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 size-56 rounded-full bg-primary/10 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/3 size-52 rounded-full bg-success/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3 sm:gap-3.5">
            <span className="brand-gradient grid size-11 shrink-0 place-items-center rounded-xl text-primary-foreground shadow-sm ring-1 ring-inset ring-white/25 sm:size-12">
              <Icon className="size-5 sm:size-[22px]" />
            </span>
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-primary">
                {eyebrow}
              </p>
              <h1 className="mt-0.5 text-[22px] font-semibold leading-tight tracking-tight text-foreground sm:text-[26px]">
                {title}
              </h1>
              {description ? (
                <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>

        {meta ? <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">{meta}</div> : null}
      </div>
    </header>
  );
}
