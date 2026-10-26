"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_DESCRIPTOR } from "@/lib/attendance/time";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/lib/domain";

const STATUS_OPTIONS: Array<{ value: AttendanceStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "Semua status" },
  ...(
    ["PRESENT", "LATE", "ABSENT", "INCOMPLETE", "LEAVE", "HOLIDAY"] as AttendanceStatus[]
  ).map((status) => ({ value: status, label: STATUS_DESCRIPTOR[status].label })),
];

/**
 * Filter bar for attendance tables.
 *
 * Filters are written into the URL rather than local state so that a filtered
 * view is shareable, survives a refresh, and works with server rendering. The
 * form submits on change instead of on Enter to keep it fast on mobile.
 */
export function AttendanceFilters({
  basePath,
  showSearch = false,
  showStatus = true,
  extra,
  embedded = false,
}: {
  basePath: string;
  showSearch?: boolean;
  showStatus?: boolean;
  extra?: React.ReactNode;
  /**
   * Drops the card chrome so the filter row can live inside an existing
   * `Surface` (the admin report card does this).
   */
  embedded?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");
  const [status, setStatus] = useState<string>(searchParams.get("status") ?? "ALL");

  const apply = useCallback(
    (patch: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        // An empty patch entry means "clear this filter".
        if (value) params.set(key, value);
        else params.delete(key);
      }
      // Any filter change invalidates the current page offset.
      if (!("page" in patch)) params.delete("page");
      const query = params.toString();
      router.push(query ? `${basePath}?${query}` : basePath, { scroll: false });
    },
    [basePath, router, searchParams],
  );

  // Debounce free-text so typing does not fire a request per keystroke.
  useEffect(() => {
    if (!showSearch) return;
    const currentSearch = searchParams.get("search") ?? "";
    if (search === currentSearch) return;
    const timer = setTimeout(() => {
      apply({ search: search || undefined });
    }, 350);
    return () => clearTimeout(timer);
  }, [apply, search, searchParams, showSearch]);

  const hasFilters =
    Boolean(search) || Boolean(from) || Boolean(to) || status !== "ALL";

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        !embedded &&
          "rounded-xl border border-border bg-card p-4 surface-elevated sm:p-5",
      )}
    >
      <div
        className={cn(
          "grid gap-3",
          embedded
            ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
            : "sm:grid-cols-2 lg:grid-cols-4",
        )}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-from" className="text-[12px]">
            Dari tanggal
          </Label>
          <Input
            id="filter-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => {
              setFrom(event.target.value);
              apply({ from: event.target.value || undefined });
            }}
            className="min-h-10"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-to" className="text-[12px]">
            Sampai tanggal
          </Label>
          <Input
            id="filter-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => {
              setTo(event.target.value);
              apply({ to: event.target.value || undefined });
            }}
            className="min-h-10"
          />
        </div>

        {showStatus ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-status" className="text-[12px]">
              Status
            </Label>
            <Select
              value={status}
              onValueChange={(value: string | null) => {
                // `null` only occurs if the select is cleared, which means "all".
                const next = value ?? "ALL";
                setStatus(next);
                apply({ status: next === "ALL" ? undefined : next });
              }}
            >
              <SelectTrigger id="filter-status" className="min-h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {showSearch ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-search" className="text-[12px]">
              Cari karyawan
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="filter-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nama, email, atau kode"
                className="min-h-10 pl-9"
              />
            </div>
          </div>
        ) : null}

        {extra}
      </div>

      {hasFilters ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setFrom("");
              setTo("");
              setStatus("ALL");
              router.push(basePath, { scroll: false });
            }}
            className="gap-1.5 text-[12.5px]"
          >
            <X className="size-3.5" />
            Reset filter
          </Button>
        </div>
      ) : null}
    </div>
  );
}