import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ScrollText, X } from "lucide-react";
import { requireUser } from "@/lib/dal/auth";
import { AUDIT_ACTION_LABEL, getAuditLog } from "@/lib/dal/audit";
import { getLocationPolicy } from "@/lib/dal/settings";
import { AuditAction } from "@/lib/domain";
import { hasRole } from "@/lib/attendance/time";
import {
  Surface,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceTitle,
  EmptyState,
} from "@/components/layout/primitives";
import { Chip, Monogram } from "@/components/layout/badges";
import { Pagination } from "@/components/attendance/pagination";

export const metadata: Metadata = {
  title: "Audit Log",
};

function readParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : undefined;
}

function formatTimestamp(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);
}

/**
 * Administrative audit trail.
 *
 * Append-only: there is intentionally no mutation surface for audit rows, so
 * the log cannot be edited from the UI even by an admin.
 */
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (!hasRole(user.role, "ADMIN")) redirect("/admin/overview");

  const params = (await searchParams) ?? {};
  const actionParam = readParam(params.action);
  const action = (
    Object.values(AuditAction) as string[]
  ).includes(actionParam ?? "")
    ? (actionParam as AuditAction)
    : ("ALL" as const);

  const search = readParam(params.search);
  const pageParam = Number.parseInt(readParam(params.page) ?? "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const log = await getAuditLog({ page, pageSize: 20, action, search });
  const policy = await getLocationPolicy();

  const hasFilters = action !== "ALL" || Boolean(search);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground sm:text-[26px]">
          Audit Log
        </h1>
        <p className="text-[13.5px] text-muted-foreground">
          Jejak aktivitas administratif, append-only. Catatan tidak dapat diubah atau dihapus dari
          antarmuka.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3.5 surface-elevated">
        <form className="flex flex-wrap items-center gap-2" method="get" action="/admin/audit-log">
          <label htmlFor="audit-action" className="text-[12px] font-medium text-muted-foreground">
            Tipe aksi
          </label>
          <select
            id="audit-action"
            name="action"
            defaultValue={action}
            className="h-9 rounded-lg border border-input bg-card px-2.5 text-[12.5px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <option value="ALL">Semua</option>
            {(Object.keys(AUDIT_ACTION_LABEL) as AuditAction[]).map((option) => (
              <option key={option} value={option}>
                {AUDIT_ACTION_LABEL[option]}
              </option>
            ))}
          </select>
          <input
            type="search"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Cari ringkasan atau nama"
            aria-label="Cari audit log"
            className="h-9 min-w-0 rounded-lg border border-input bg-card px-3 text-[12.5px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 sm:w-56"
          />
          <button
            type="submit"
            className="h-9 rounded-lg bg-primary px-3.5 text-[12.5px] font-medium text-primary-foreground"
          >
            Terapkan
          </button>
        </form>

        {hasFilters ? (
          <a
            href="/admin/audit-log"
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-[12.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
            Reset
          </a>
        ) : null}
      </div>

      <Surface className="mt-4 overflow-hidden sm:mt-5">
        <SurfaceHeader>
          <SurfaceTitle>Aktivitas Tercatat</SurfaceTitle>
          <SurfaceDescription className="mt-1">
            {log.total} catatan, terbaru lebih dulu.
          </SurfaceDescription>
        </SurfaceHeader>

        {log.rows.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="Belum ada aktivitas"
            description="Catatan akan muncul di sini setiap admin mengubah karyawan, jadwal, lokasi, atau pengaturan."
          />
        ) : (
          <ul className="divide-y divide-border">
            {log.rows.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 px-5 py-4 sm:px-6">
                {entry.actor ? (
                  <Monogram name={entry.actor.name} size="sm" />
                ) : (
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                    SYS
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Chip>{AUDIT_ACTION_LABEL[entry.action] ?? entry.action}</Chip>
                    <span className="text-[11.5px] text-muted-foreground">
                      {entry.entityType}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">
                    {entry.summary}
                  </p>
                  <p className="tabular mt-1 text-[11.5px] text-muted-foreground">
                    {entry.actor?.name ?? "Sistem"}
                    {entry.ipAddress ? ` · ${entry.ipAddress}` : ""} ·{" "}
                    {formatTimestamp(entry.createdAt, policy.timezone)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Pagination
          page={log.page}
          pageCount={log.pageCount}
          total={log.total}
          pageSize={log.pageSize}
          basePath="/admin/audit-log"
          searchParams={{
            action: action === "ALL" ? undefined : action,
            search,
          }}
        />
      </Surface>
    </div>
  );
}