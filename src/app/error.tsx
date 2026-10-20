"use client";

import { useEffect } from "react";
import Link from "next/link";
import { LogIn, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/layout/primitives";

/**
 * Root error boundary.
 *
 * Nothing sensitive from the thrown value is rendered — the digest is enough to
 * correlate with server logs without leaking a stack trace to the browser.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] unhandled error", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card surface-elevated">
        <ErrorState
          title="Terjadi kesalahan"
          description={
            error.message
              ? "Halaman ini gagal dimuat. Coba muat ulang; jika tetap gagal, hubungi admin."
              : "Halaman ini gagal dimuat. Coba muat ulang."
          }
          action={
            <div className="flex gap-2">
              <Button onClick={reset} variant="outline" className="gap-2">
                <RefreshCw className="size-4" />
                Coba lagi
              </Button>
              <Button render={<Link href="/dashboard" />} className="gap-2">
                <LogIn className="size-4" />
                Ke beranda
              </Button>
            </div>
          }
        />
        {error.digest ? (
          <p className="px-6 pb-5 text-center text-[11.5px] text-muted-foreground">
            Kode rujukan: <span className="tabular">{error.digest}</span>
          </p>
        ) : null}
      </div>
    </main>
  );
}