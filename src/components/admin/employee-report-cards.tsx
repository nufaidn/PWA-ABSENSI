"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Download,
  Eye,
  FileClock,
  Loader2,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Monogram, ProgressMeter, StatusBadge } from "@/components/layout/badges";
import { Surface } from "@/components/layout/primitives";
import { STATUS_DESCRIPTOR, formatDuration } from "@/lib/attendance/time";
import { employeeReportApiHref, employeeReportDetailHref } from "@/lib/report-links";
import type {
  EmployeeReportCardSummary,
  EmployeeReportDetail,
} from "@/lib/report-types";
import { cn } from "@/lib/utils";

/**
 * Employee report cards.
 *
 * The list is rendered from server-fetched summaries. Clicking the eye opens a
 * dialog and fetches that employee's daily records on demand, so the initial
 * page never has to serialise every attendance row to the browser.
 */

const DOWNLOAD_CLASS =
  "inline-grid size-8 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none";

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/25 px-2.5 py-2">
      <dt className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("tabular mt-0.5 text-[17px] font-semibold leading-none", tone)}>
        {value}
      </dd>
    </div>
  );
}

function RecordNote({
  lateMinutes,
  outsideRadius,
  distanceMeters,
}: {
  lateMinutes: number;
  outsideRadius: boolean;
  distanceMeters: number | null;
}) {
  if (lateMinutes <= 0 && !outsideRadius) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground">
      {lateMinutes > 0 ? <span>Telat {lateMinutes} mnt</span> : null}
      {outsideRadius ? (
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3" aria-hidden />
          luar radius
          {distanceMeters !== null ? ` (${Math.round(distanceMeters)} m)` : ""}
        </span>
      ) : null}
    </span>
  );
}

function toneForRate(rate: number): "success" | "warning" {
  return rate >= 90 ? "success" : "warning";
}

export function EmployeeReportCards({
  employees,
  fromKey,
  toKey,
}: {
  employees: EmployeeReportCardSummary[];
  fromKey: string;
  toKey: string;
}) {
  const [selected, setSelected] = React.useState<EmployeeReportCardSummary | null>(null);
  const [detail, setDetail] = React.useState<EmployeeReportDetail | null>(null);
  const [state, setState] = React.useState<"idle" | "loading" | "error">("idle");
  const requestId = React.useRef(0);

  async function openDetail(employee: EmployeeReportCardSummary) {
    const id = ++requestId.current;
    setSelected(employee);
    setDetail(null);
    setState("loading");

    const params = new URLSearchParams({ from: fromKey, to: toKey });

    try {
      const response = await fetch(
        `/api/attendance/report/${encodeURIComponent(employee.userId)}/detail?${params.toString()}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(`Request failed with ${response.status}`);

      const payload = (await response.json()) as EmployeeReportDetail;
      if (requestId.current !== id) return;
      setDetail(payload);
      setState("idle");
    } catch {
      if (requestId.current !== id) return;
      setState("error");
    }
  }

  function closeDialog() {
    // Invalidate any in-flight request so a slow response cannot repopulate a
    // dialog the admin already closed.
    requestId.current += 1;
    setSelected(null);
    setDetail(null);
    setState("idle");
  }

  return (
    <>
      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
        {employees.map((employee) => {
          const summary = employee.summary;
          return (
            <Surface key={employee.userId} className="flex h-full flex-col p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <Monogram name={employee.name} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-foreground">
                    {employee.name}
                  </p>
                  <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                    {employee.employeeCode ?? "—"} ·{" "}
                    {employee.department ?? "Tanpa departemen"}
                  </p>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-2">
                <Metric
                  label="Hadir"
                  value={summary.present}
                  tone="text-[oklch(0.36_0.09_163)]"
                />
                <Metric
                  label="Terlambat"
                  value={summary.late}
                  tone="text-[oklch(0.42_0.11_76)]"
                />
                <Metric label="Alpa" value={summary.absent} tone="text-destructive" />
                <Metric
                  label="Izin / Cuti"
                  value={summary.leave}
                  tone="text-[oklch(0.34_0.09_234)]"
                />
              </dl>

              <div className="mt-3.5">
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="text-muted-foreground">Tingkat kehadiran</span>
                  <span className="tabular font-medium text-foreground">
                    {summary.attendanceRate}%
                  </span>
                </div>
                <ProgressMeter
                  value={summary.attendanceRate}
                  tone={toneForRate(summary.attendanceRate)}
                  label={`Tingkat kehadiran ${employee.name}`}
                  className="mt-1.5"
                />
              </div>

              <div className="mt-auto pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <span className="text-[11.5px] text-muted-foreground">
                    Total{" "}
                    <span className="tabular font-medium text-foreground">
                      {formatDuration(summary.totalWorkedMinutes)}
                    </span>
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void openDetail(employee)}
                      aria-label={`Lihat detail absensi ${employee.name}`}
                      className="gap-1.5"
                    >
                      <Eye className="size-3.5" aria-hidden />
                      Lihat detail
                    </Button>
                    <a
                      href={employeeReportApiHref(employee.userId, fromKey, toKey)}
                      download
                      aria-label={`Unduh laporan PDF ${employee.name}`}
                      title={`Unduh laporan PDF ${employee.name}`}
                      className={DOWNLOAD_CLASS}
                    >
                      <Download className="size-4" aria-hidden />
                    </a>
                  </div>
                </div>
              </div>
            </Surface>
          );
        })}
      </div>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="max-h-[88dvh] overflow-y-auto p-5 sm:max-w-3xl">
          <DialogHeader className="pr-8">
            <DialogTitle>
              Detail Absensi{selected ? ` — ${selected.name}` : ""}
            </DialogTitle>
            <DialogDescription>
              {fromKey} sampai {toKey}
              {selected
                ? ` · ${selected.employeeCode ?? "—"} · ${selected.department ?? "Tanpa departemen"}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {state === "loading" ? (
            <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Memuat detail absensi…
            </div>
          ) : null}

          {state === "error" ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-[13.5px] font-medium text-foreground">
                Detail absensi gagal dimuat.
              </p>
              <p className="max-w-sm text-[12.5px] text-muted-foreground">
                Periksa koneksi lalu coba lagi. Filter tanggal pada laporan tidak berubah.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => selected && void openDetail(selected)}
              >
                Coba lagi
              </Button>
            </div>
          ) : null}

          {state === "idle" && detail ? (
            <DetailContent detail={detail} fromKey={fromKey} toKey={toKey} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DetailContent({
  detail,
  fromKey,
  toKey,
}: {
  detail: EmployeeReportDetail;
  fromKey: string;
  toKey: string;
}) {
  // Newest first on screen, the same as the full detail page.
  const rows = [...detail.rows].reverse();
  const summary = detail.summary;

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 text-[12.5px] sm:grid-cols-3">
        <div>
          <dt className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
            Nama
          </dt>
          <dd className="mt-0.5 truncate font-medium text-foreground">
            {detail.employee.name}
          </dd>
        </div>
        <div>
          <dt className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
            ID / Departemen
          </dt>
          <dd className="mt-0.5 truncate font-medium text-foreground">
            {detail.employee.employeeCode ?? "—"} ·{" "}
            {detail.employee.department ?? "Tanpa departemen"}
          </dd>
        </div>
        <div>
          <dt className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
            Email
          </dt>
          <dd className="mt-0.5 truncate font-medium text-foreground">
            {detail.employee.email}
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatChip label="Hadir" value={summary.present} tone="success" />
        <StatChip label="Terlambat" value={summary.late} tone="warning" />
        <StatChip label="Alpa" value={summary.absent} tone="danger" />
        <StatChip label="Izin / Cuti" value={summary.leave} tone="info" />
      </div>

      <p className="text-[11.5px] text-muted-foreground">
        {rows.length} catatan · total {formatDuration(summary.totalWorkedMinutes)} · rata-rata{" "}
        {formatDuration(detail.averageWorkedMinutes)}/hari · kehadiran{" "}
        {summary.attendanceRate}% · ketepatan {summary.punctualityRate}%
      </p>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border py-10 text-center">
          <FileClock className="size-5 text-muted-foreground" aria-hidden />
          <p className="text-[13px] font-medium text-foreground">Belum ada catatan</p>
          <p className="max-w-xs text-[12px] text-muted-foreground">
            Karyawan ini belum memiliki catatan absensi pada periode yang dipilih.
          </p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border sm:hidden">
            {rows.map((row) => {
              const descriptor = STATUS_DESCRIPTOR[row.status];
              return (
                <li key={row.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="tabular text-[12.5px] font-medium text-foreground">
                      {row.dateLabel}
                    </p>
                    <StatusBadge
                      label={descriptor.label}
                      className={descriptor.className}
                      dotClassName={descriptor.dotClassName}
                    />
                  </div>
                  <dl className="tabular mt-2 grid grid-cols-4 gap-2 text-[11.5px]">
                    <div>
                      <dt className="text-muted-foreground">Masuk</dt>
                      <dd className="mt-0.5 font-medium">{row.checkInTime}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Keluar</dt>
                      <dd className="mt-0.5 font-medium">{row.checkOutTime}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Durasi</dt>
                      <dd className="mt-0.5 font-medium">
                        {formatDuration(row.workedMinutes)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Telat</dt>
                      <dd className="mt-0.5 font-medium">
                        {row.lateMinutes > 0 ? `${row.lateMinutes}m` : "—"}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-1.5">
                    <RecordNote
                      lateMinutes={row.lateMinutes}
                      outsideRadius={row.outsideRadius}
                      distanceMeters={row.distanceMeters}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
            <table className="w-full min-w-[620px] text-left text-[12.5px]">
              <caption className="sr-only">Riwayat absensi {detail.employee.name}</caption>
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-medium">Tanggal</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 font-medium">Masuk</th>
                  <th scope="col" className="px-3 py-2 font-medium">Keluar</th>
                  <th scope="col" className="px-3 py-2 font-medium">Telat</th>
                  <th scope="col" className="px-3 py-2 font-medium">Durasi</th>
                  <th scope="col" className="px-3 py-2 font-medium">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => {
                  const descriptor = STATUS_DESCRIPTOR[row.status];
                  return (
                    <tr key={row.id}>
                      <td className="tabular px-3 py-2.5 whitespace-nowrap">
                        {row.dateLabel}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge
                          label={descriptor.label}
                          className={descriptor.className}
                          dotClassName={descriptor.dotClassName}
                        />
                      </td>
                      <td className="tabular px-3 py-2.5">{row.checkInTime}</td>
                      <td className="tabular px-3 py-2.5">{row.checkOutTime}</td>
                      <td className="tabular px-3 py-2.5">
                        {row.lateMinutes > 0 ? `${row.lateMinutes} mnt` : "—"}
                      </td>
                      <td className="tabular px-3 py-2.5 whitespace-nowrap">
                        {formatDuration(row.workedMinutes)}
                      </td>
                      <td className="px-3 py-2.5">
                        <RecordNote
                          lateMinutes={row.lateMinutes}
                          outsideRadius={row.outsideRadius}
                          distanceMeters={row.distanceMeters}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
        <Link
          href={employeeReportDetailHref(detail.employee.id, fromKey, toKey)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-accent"
        >
          <ArrowUpRight className="size-3.5" aria-hidden />
          Buka halaman lengkap
        </Link>
        <a
          href={employeeReportApiHref(detail.employee.id, fromKey, toKey)}
          download
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12.5px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Download className="size-3.5" aria-hidden />
          Unduh PDF
        </a>
      </div>
    </div>
  );
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "danger" | "info";
}) {
  const tones = {
    success: "bg-success-muted/70 text-[oklch(0.36_0.09_163)]",
    warning: "bg-warning-muted/70 text-[oklch(0.42_0.11_76)]",
    danger: "bg-destructive/8 text-destructive",
    info: "bg-info-muted/70 text-[oklch(0.34_0.09_234)]",
  } as const;

  return (
    <div className={cn("rounded-lg px-3 py-2.5", tones[tone])}>
      <p className="text-[10.5px] font-medium uppercase tracking-wide opacity-80">
        {label}
      </p>
      <p className="tabular mt-0.5 text-[20px] font-semibold leading-none">{value}</p>
    </div>
  );
}
