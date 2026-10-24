import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/dal/auth";
import { hasRole } from "@/lib/attendance/time";
import { AdminLoginForm } from "./admin-login-form";

/**
 * Public admin sign-in at `/admin`.
 *
 * Kept outside the `(app)` route group so `proxy.ts` does not bounce an
 * administrator away from the page that would let them sign in. The admin
 * dashboard itself lives at `/admin/overview`.
 *
 * Mobile-first, like the employee login: one column, a branded hero, and a form
 * that fits a 360px screen without scrolling the submit button out of reach.
 */

export const metadata: Metadata = {
  title: "Masuk Admin",
};

/**
 * Default email pre-filled into the field.
 *
 * Public by nature — it names the account, not any secret, and the password
 * still has to be typed. It exists so the operator does not have to remember
 * which of several admin accounts is the primary one.
 */
const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL ?? "admin@gmail.com";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const user = await getCurrentUser();

  // Already signed in: forward rather than showing a form that would just fail.
  if (user) {
    redirect(hasRole(user.role, "ADMIN") ? "/admin/overview" : "/dashboard");
  }

  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      <div aria-hidden className="brand-wash pointer-events-none absolute inset-x-0 top-0 h-[420px]" />

      <div className="relative flex flex-1 flex-col">
        <header className="px-6 pb-10 pt-9 sm:pb-12 sm:pt-14">
          <div className="mx-auto flex w-full max-w-[400px] flex-col items-center text-center">
            <span className="brand-gradient grid size-14 place-items-center rounded-2xl text-white shadow-lg shadow-primary/30 sm:size-16">
              <ShieldCheck className="size-7 sm:size-8" aria-hidden />
            </span>
            <h1 className="mt-5 text-[26px] font-semibold tracking-tight text-foreground sm:text-[28px]">
              Panel Administrator
            </h1>
            <p className="mt-2 max-w-[19rem] text-[13.5px] leading-relaxed text-muted-foreground">
              Area khusus untuk mengelola karyawan, jadwal, dan laporan absensi.
            </p>
          </div>
        </header>

        <div className="flex flex-1 flex-col px-4 pb-6 sm:px-4 sm:pb-10">
          <div className="mx-auto w-full max-w-[400px]">
            <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground surface-elevated sm:p-6">
              <div className="mb-5">
                <h2 className="text-[15px] font-semibold tracking-tight">Masuk sebagai Admin</h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                  Gunakan akun dengan hak Admin.
                </p>
              </div>

              <AdminLoginForm next={next} defaultEmail={DEFAULT_ADMIN_EMAIL} />
            </div>

            <p className="mt-6 px-1 text-center text-[12px] leading-relaxed text-muted-foreground">
              Bukan administrator?{" "}
              <a href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
                Masuk sebagai karyawan
              </a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}