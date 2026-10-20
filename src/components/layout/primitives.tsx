import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal building blocks shared across the app.
 *
 * These are intentionally plain rather than pulled from a component library:
 * the design language here is a single white card with a hairline border and
 * very soft elevation, which is easier to keep consistent with three small
 * primitives than with a dozen heavily-styled variants.
 *
 * Deliberately *not* a Client Component. There is no state, no effect and no
 * event handler here, and several primitives (`Stat`, `EmptyState`) accept a
 * component as the `icon` prop. Marking this file `"use client"` would force
 * every icon to cross the Server→Client boundary as a prop, which React rejects
 * outright: only plain objects may cross, so each `<Stat icon={UserCheck} />`
 * rendered from a page would fail with "Only plain objects can be passed to
 * Client Components". Keeping the file server-renderable lets the icon be
 * rendered on the server alongside the card that uses it.
 *
 * Client Components (e.g. `app/error.tsx`) can still import these — importing a
 * non-client component from a client one just pulls it into the client bundle.
 */

export function Surface({
  className,
  accentBar,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { accentBar?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground surface-elevated",
        accentBar && "surface-accent-bar overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

export function SurfaceHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 border-b border-border px-5 py-4 sm:px-6",
        className,
      )}
      {...props}
    />
  );
}

export function SurfaceTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-[15px] font-semibold tracking-tight text-foreground", className)}
      {...props}
    />
  );
}

export function SurfaceDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-[13px] leading-relaxed text-muted-foreground", className)} {...props} />
  );
}

export function SurfaceBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-5 sm:px-6", className)} {...props} />;
}

/**
 * Tints for a stat card.
 *
 * The card itself is tinted, not just the icon badge. A dashboard is a grid of
 * these and when they were all plain white on a tinted page the whole screen
 * read as flat — the only colour was a 32px square in the corner.
 */
const STAT_TONES: Record<
  StatTone,
  { card: string; badge: string; icon: string }
> = {
  neutral: {
    card: "bg-card",
    badge: "bg-accent text-accent-foreground",
    icon: "text-accent-foreground",
  },
  success: {
    card: "bg-success-muted/70",
    badge: "bg-success/15 text-[oklch(0.36_0.09_163)]",
    icon: "text-[oklch(0.36_0.09_163)]",
  },
  warning: {
    card: "bg-warning-muted/70",
    badge: "bg-warning/20 text-[oklch(0.42_0.11_76)]",
    icon: "text-[oklch(0.42_0.11_76)]",
  },
  danger: {
    card: "bg-destructive/8",
    badge: "bg-destructive/15 text-destructive",
    icon: "text-destructive",
  },
  info: {
    card: "bg-info-muted/70",
    badge: "bg-info/15 text-[oklch(0.34_0.09_234)]",
    icon: "text-[oklch(0.34_0.09_234)]",
  },
  primary: {
    card: "bg-accent/80",
    badge: "bg-primary/15 text-primary",
    icon: "text-primary",
  },
};

type StatTone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: StatTone;
  className?: string;
}) {
  const colors = STAT_TONES[tone];

  return (
    <Surface
      className={cn("p-4 transition-shadow hover:shadow-md sm:p-5", colors.card, className)}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {Icon ? (
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", colors.badge)}>
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <p className="tabular mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-[13px] text-muted-foreground">{hint}</p> : null}
    </Surface>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </span>
      ) : null}
      <div className="space-y-1.5">
        <p className="text-[15px] font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Terjadi kesalahan",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-xl bg-destructive/10 text-destructive">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div className="space-y-1.5">
        <p className="text-[15px] font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/** Skeleton block used while a Server Component's data is in flight. */
export function LoadingCard({ className }: { className?: string }) {
  return (
    <Surface className={cn("p-5", className)}>
      <div className="space-y-3">
        <div className="h-3.5 w-32 rounded bg-muted" />
        <div className="h-8 w-24 rounded bg-muted" />
        <div className="h-3 w-40 rounded bg-muted/70" />
      </div>
    </Surface>
  );
}