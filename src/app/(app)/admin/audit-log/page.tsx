import type { Metadata } from "next";
import type { ComponentType } from "react";
import { redirect } from "next/navigation";
import {
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  Clock,
  KeyRound,
  MapPin,
  MapPinOff,
  Pencil,
  ScrollText,
  Settings,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
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
import { AdminFact, AdminHeader } from "@/components/admin/admin-header";
import { Pagination } from "@/components/attendance/pagination";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Audit Log",
};

/**
 * Visual identity per audit action.
 *
 * A flat chip told the operator *what* changed but not what kind of event it
 * was; scanning twenty rows meant reading every label. The icon and the tint
 * group the trail at a glance — creation green, edits blue, deletion red,
 * access changes amber — while the label still carries the meaning.
 */
const ACTION_TONE = {
  create: {
    tile: "bg-success-muted text-[oklch(0.34_0.08_163)] ring-success/25",
    badge: "bg-success-muted/70 text-[oklch(0.34_0.08_163)] ring-success/25",
  },
  update: {
    tile: "bg-accent text-primary ring-primary/15",
    badge: "bg-primary/8 text-primary ring-primary/20",
  },
  remove: {
    tile: "bg-destructive/10 text-destructive ring-destructive/20",
    badge: "bg-destructive/8 text-destructive ring-destructive/20",
  },
  access: {
    tile: "bg-warning-muted text-[oklch(0.42_0.11_76)] ring-warning/30",
    badge: "bg-warning-muted/70 text-[oklch(0.42_0.11_76)] ring-warning/30",
  },
  info: {
    tile: "bg-info-muted text-[oklch(0.34_0.09_234)] ring-info/25",
    badge: "bg-info-muted/70 text-[oklch(0.34_0.09_234)] ring-info/25",
  },
} as const;

const ACTION_META: Record<
  AuditAction,
  { icon: ComponentType<{ className?: string }>; tone: keyof typeof ACTION_TONE }
> = {
  EMPLOYEE_CREATED: { icon: UserPlus, tone: "create" },
  EMPLOYEE_UPDATED: { icon: Pencil, tone: "update" },
  EMPLOYEE_DEACTIVATED: { icon: UserX, tone: "access" },
  EMPLOYEE_REACTIVATED: { icon: UserCheck, tone: "create" },
  EMPLOYEE_DELETED: { icon: Trash2, tone: "remove" },
  EMPLOYEE_ROLE_CHANGED: { icon: ShieldCheck, tone: "update" },
  EMPLOYEE_PASSWORD_RESET: { icon: KeyRound, tone: "access" },
  SCHEDULE_CREATED: { icon: CalendarPlus, tone: "create" },
  SCHEDULE_UPDATED: { icon: CalendarClock, tone: "update" },
  SCHEDULE_DELETED: { icon: CalendarX2, tone: "remove" },
  ATTENDANCE_ADJUSTED: { icon: Clock, tone: "info" },
  SETTINGS_UPDATED: { icon: Settings, tone: "update" },
  LOCATION_CREATED: { icon: MapPin, tone: "create" },
  LOCATION_UPDATED: { icon: MapPin, tone: "update" },
  LOCATION_DELETED: { icon: MapPinOff, tone: "remove" },
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
 * the log cannot be edited from the UI even by a super admin.
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
      <AdminHeader
        icon={ScrollText}
        eyebrow="Keamanan"
        title="Audit Log"
        description="Jejak aktivitas administratif, append-only. Catatan tidak dapat diubah atau dihapus dari antarmuka."
        meta={
          <>
            <AdminFact icon={ScrollText} label="Total" value={log.total} tone="primary" />
            <AdminFact
              icon={ShieldCheck}
              label="Filter"
              value={
                action === "ALL" && !search
                  ? "Semua aktivitas"
                  : [action === "ALL" ? null : AUDIT_ACTION_LABEL[action], search ? `“${search}”` : null]
                      .filter(Boolean)
                      .join(" · ")
              }
              tone={hasFilters ? "warning" : "neutral"}
            />
            <AdminFact
              icon={Clock}
              label="Zona waktu"
              value={policy.timezone}
            />
          </>
        }
      />

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
            {log.rows.map((entry) => {
              const meta = ACTION_META[entry.action] ?? { icon: ScrollText, tone: "info" as const };
              const tone = ACTION_TONE[meta.tone];
              const Icon = meta.icon;

              return (
                <li
                  key={entry.id}
                  className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-muted/40 sm:px-6"
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset",
                      tone.tile,
                    )}
                    aria-hidden
                  >
                    <Icon className="size-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                          tone.badge,
                        )}
                      >
                        {AUDIT_ACTION_LABEL[entry.action] ?? entry.action}
                      </span>
                      <span className="text-[11.5px] text-muted-foreground">
                        {entry.entityType}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">
                      {entry.summary}
                    </p>
                    <p className="tabular mt-1 text-[11.5px] text-muted-foreground">
                      <span className="font-medium text-foreground/70">
                        {entry.actor?.name ?? "Sistem"}
                      </span>
                      {entry.ipAddress ? ` · ${entry.ipAddress}` : ""} ·{" "}
                      {formatTimestamp(entry.createdAt, policy.timezone)}
                    </p>
                  </div>
                </li>
              );
            })}
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
