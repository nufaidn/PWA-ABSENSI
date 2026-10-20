import { redirect } from "next/navigation";
import { CalendarCheck2, MapPin, Radio } from "lucide-react";
import { getCurrentUser } from "@/lib/dal/auth";
import { hasRole } from "@/lib/attendance/time";
import { LoginForm } from "./login-form";

/**
 * Public login screen.
 *
 * An already-signed-in visitor is forwarded to the right landing page so the
 * login form never flashes before the dashboard.
 *
 * Laid out mobile-first: the whole thing is one column that fits a 360px screen
 * without scrolling the form out of reach, and the form card deliberately
 * overlaps the hero so the page reads as one surface rather than two stacked
 * boxes. From `sm` up the hero and card settle into a centred two-tone panel.
 */

const FEATURES = [
  { icon: CalendarCheck2, label: "Check-in satu ketukan" },
  { icon: MapPin, label: "Validasi lokasi opsional" },
  { icon: Radio, label: "Dashboard admin langsung" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const user = await getCurrentUser();

  if (user) {
    redirect(hasRole(user.role, "ADMIN") ? "/admin/overview" : "/dashboard");
  }

  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      {/* Soft brand wash behind the hero. Decorative only. */}
      <div aria-hidden className="brand-wash pointer-events-none absolute inset-x-0 top-0 h-[420px]" />

      <div className="relative flex flex-1 flex-col">
        {/* Hero --------------------------------------------------------- */}
        <header className="px-6 pb-10 pt-9 sm:pb-12 sm:pt-14">
          <div className="mx-auto flex w-full max-w-[400px] flex-col items-center text-center">
            <span className="brand-gradient grid size-14 place-items-center rounded-2xl text-white shadow-lg shadow-primary/30 sm:size-16">
              <svg
                viewBox="0 0 24 24"
                className="size-7 sm:size-8"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                aria-hidden
              >
                <rect x="3" y="4" width="18" height="17" rx="3" />
                <path
                  d="M8 2v4M16 2v4M3 10h18M9 15l2 2 4-4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>

            <h1 className="mt-5 text-[26px] font-semibold tracking-tight text-foreground sm:text-[28px]">
              Universal Attendance
            </h1>
            <p className="mt-2 max-w-[19rem] text-[13.5px] leading-relaxed text-muted-foreground">
              Catat kehadiran harian Anda dengan cepat dan akurat.
            </p>
          </div>
        </header>

        {/* Form card ---------------------------------------------------- */}
        <div className="flex flex-1 flex-col px-4 pb-6 sm:px-4 sm:pb-10">
          <div className="mx-auto w-full max-w-[400px]">
            <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground surface-elevated sm:p-6">
              <div className="mb-5">
                <h2 className="text-[15px] font-semibold tracking-tight">Masuk ke akun Anda</h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                  Gunakan email yang terdaftar di perusahaan Anda.
                </p>
              </div>

              <LoginForm next={next} />
            </div>

            {/* Feature list — reassurance on a small screen without adding
                height above the fold on the one that matters. */}
            <ul className="mt-6 grid gap-2.5 px-1">
              {FEATURES.map((feature) => (
                <li key={feature.label} className="flex items-center gap-2.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                    <feature.icon className="size-3.5" aria-hidden />
                  </span>
                  <span className="text-[12.5px] leading-snug text-muted-foreground">
                    {feature.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}