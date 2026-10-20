import { LoadingCard, Stat } from "@/components/layout/primitives";

/**
 * Route-level loading state.
 *
 * Matches the shape of the real dashboard so the layout does not shift when
 * data arrives — a jarring reflow is worse than a brief skeleton on mobile.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 space-y-2">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-7 w-56 rounded bg-muted" />
        <div className="h-3.5 w-72 max-w-full rounded bg-muted/70" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-6">
        <LoadingCard className="min-h-[420px]" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Stat label="Kehadiran" value="—" />
          <Stat label="Ketepatan" value="—" />
          <Stat label="Total Jam Kerja" value="—" />
          <Stat label="Alpa" value="—" />
        </div>
      </div>
    </div>
  );
}