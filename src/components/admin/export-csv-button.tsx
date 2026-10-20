"use client";

import { useSearchParams } from "next/navigation";
import { Download, FileSpreadsheet } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Export button that downloads the CSV for the *currently applied* filters.
 *
 * Filters are read straight from the URL so the download always matches what
 * the admin is looking at, with no second set of form state to keep in sync.
 */
export function ExportCsvButton({ basePath }: { basePath: string }) {
  const searchParams = useSearchParams();
  const search = searchParams.get("search");
  const department = searchParams.get("department");
  const status = searchParams.get("status");

  function href(): string {
    const params = new URLSearchParams();
    for (const key of ["from", "to", "search", "department", "status"]) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="export-csv" className="text-[12px]">
        Ekspor
      </Label>
      <a
        id="export-csv"
        href={href()}
        download
        className={cn(
          "inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <Download className="size-4" />
        Unduh CSV
      </a>
      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
        Mencakup filter aktif: {search ? `pencarian “${search}”` : "semua karyawan"}
        {department ? ` · departemen ${department}` : ""}
        {status && status !== "ALL" ? ` · status ${status}` : ""}.
      </p>
    </div>
  );
}

/** Compact card explaining what an export contains. */
export function ExportHint() {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/60 px-3.5 py-3">
      <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        Berkas CSV mengikuti RFC 4180 dan dilengkapi BOM UTF-8 sehingga karakter
        non-ASCII tampil benar saat dibuka di Excel.
      </p>
    </div>
  );
}