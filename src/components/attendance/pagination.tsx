import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pagination control.
 *
 * Pagination is server-side because attendance datasets can be large. The
 * control is built from plain links so every page state is bookmarkable and the
 * component still works before JavaScript has hydrated.
 */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  basePath,
  searchParams,
  unit = "catatan",
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
  /** Noun used in the count line, e.g. "karyawan" on the report card list. */
  unit?: string;
}) {
  if (pageCount <= 1) {
    return (
      <p className="tabular px-5 py-3.5 text-[12.5px] text-muted-foreground sm:px-6">
        {total} {unit}
      </p>
    );
  }

  function hrefFor(target: number): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== "page") params.set(key, value);
    }
    params.set("page", String(target));
    return `${basePath}?${params.toString()}`;
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3.5 sm:px-6">
      <p className="tabular text-[12.5px] text-muted-foreground">
        Menampilkan {from}–{to} dari {total} {unit}
      </p>

      <nav aria-label="Paginasi" className="flex items-center gap-2">
        <PageLink href={hrefFor(page - 1)} disabled={page <= 1}>
          <ChevronLeft className="size-3.5" />
          Sebelumnya
        </PageLink>

        <span className="tabular px-1 text-[12.5px] text-muted-foreground">
          {page} / {pageCount}
        </span>

        <PageLink href={hrefFor(page + 1)} disabled={page >= pageCount}>
          Berikutnya
          <ChevronRight className="size-3.5" />
        </PageLink>
      </nav>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const base =
    "inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-[12.5px] font-medium transition-colors";

  if (disabled) {
    return (
      <span aria-disabled className={cn(base, "cursor-not-allowed text-muted-foreground/50")}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={cn(base, "bg-card text-foreground hover:bg-accent")}>
      {children}
    </Link>
  );
}