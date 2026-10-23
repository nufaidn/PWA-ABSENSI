"use client";

import * as React from "react";
import { KeyRound, Pencil, Search, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AddEmployeeButton,
  ActiveToggle,
  DeleteEmployeeDialog,
  EmployeeDialog,
  ResetPasswordDialog,
  type EmployeeFormValues,
} from "@/components/admin/employee-dialogs";
import { Monogram, Chip } from "@/components/layout/badges";
import { ROLE_LABEL } from "@/lib/attendance/time";

/**
 * Employee roster.
 *
 * Roster data is fetched on the server and passed in; this component only owns
 * dialog state. Every action it triggers re-authorizes on the server.
 */

export interface RosterEntry extends EmployeeFormValues {
  createdAt: string;
  scheduleName: string | null;
}

export function EmployeeRoster({
  employees,
  schedules,
  canManageRoles,
  currentUserId,
}: {
  employees: RosterEntry[];
  schedules: Array<{ id: string; name: string; workingDays: number[] }>;
  canManageRoles: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = React.useState(searchParams.get("search") ?? "");
  const [role, setRole] = React.useState(searchParams.get("role") ?? "ALL");
  const [active, setActive] = React.useState(searchParams.get("active") ?? "ALL");

  const [editing, setEditing] = React.useState<RosterEntry | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [resetting, setResetting] = React.useState<RosterEntry | null>(null);
  const [deleting, setDeleting] = React.useState<RosterEntry | null>(null);

  function apply(next: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged: Record<string, string | undefined> = { search, role, active, ...next };
    for (const [key, value] of Object.entries(merged)) {
      if (value && value !== "ALL") params.set(key, value);
    }
    const query = params.toString();
    router.push(query ? `/admin/employees?${query}` : "/admin/employees", { scroll: false });
    router.refresh();
  }

  // Debounce so typing does not fire a request per keystroke.
  React.useEffect(() => {
    const current = searchParams.get("search") ?? "";
    if (search === current) return;
    const timer = setTimeout(() => apply({ search: search || undefined }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama, email, atau kode karyawan"
            aria-label="Cari karyawan"
            className="min-h-10 pl-9"
          />
        </div>

        <select
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            apply({ role: event.target.value });
          }}
          aria-label="Filter role"
          className="h-10 rounded-lg border border-input bg-card px-3 text-[13px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          <option value="ALL">Semua role</option>
          <option value="EMPLOYEE">Karyawan</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>

        <select
          value={active}
          onChange={(event) => {
            setActive(event.target.value);
            apply({ active: event.target.value });
          }}
          aria-label="Filter status akun"
          className="h-10 rounded-lg border border-input bg-card px-3 text-[13px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          <option value="ALL">Semua status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>
      </div>

      {employees.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Users className="size-5" />
          </span>
          <div className="space-y-1.5">
            <p className="text-[15px] font-semibold">Tidak ada karyawan</p>
            <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              {search || role !== "ALL" || active !== "ALL"
                ? "Tidak ada karyawan yang cocok dengan filter aktif."
                : "Tambahkan karyawan pertama untuk mulai mencatat absensi."}
            </p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {employees.map((employee) => (
            <li
              key={employee.id}
              className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40 sm:px-6"
            >
              <Monogram name={employee.name} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="truncate text-[13.5px] font-medium text-foreground">
                    {employee.name}
                  </p>
                  <Chip>{ROLE_LABEL[employee.role]}</Chip>
                  {employee.id === currentUserId ? <Chip className="border-primary/30 text-primary">Anda</Chip> : null}
                  {!employee.isActive ? (
                    <Chip className="border-destructive/30 text-destructive">Nonaktif</Chip>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                  {employee.email}
                  {employee.employeeCode ? ` · ${employee.employeeCode}` : ""}
                  {employee.department ? ` · ${employee.department}` : ""}
                </p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                  Jadwal: {employee.scheduleName ?? "default organisasi"}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <ActiveToggle
                  employee={employee}
                  // Guard rails that mirror the server-side invariants, so the
                  // UI does not offer an action the server will reject.
                  disabled={
                    employee.id === currentUserId ||
                    (employee.role === "SUPER_ADMIN" && employee.isActive)
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Ubah ${employee.name}`}
                  onClick={() => setEditing(employee)}
                  className="size-9"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Reset password ${employee.name}`}
                  onClick={() => setResetting(employee)}
                  className="size-9"
                >
                  <KeyRound className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Hapus ${employee.name}`}
                  onClick={() => setDeleting(employee)}
                  disabled={employee.id === currentUserId}
                  className="size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <EmployeeDialog
        open={creating}
        onOpenChange={setCreating}
        schedules={schedules}
      />
      <EmployeeDialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        schedules={schedules}
        employee={editing ?? undefined}
      />
      <ResetPasswordDialog
        open={Boolean(resetting)}
        onOpenChange={(open) => {
          if (!open) setResetting(null);
        }}
        employee={resetting ?? undefined}
      />
      <DeleteEmployeeDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        employee={deleting ?? undefined}
      />

      <div className="flex justify-end">
        <AddEmployeeButton onClick={() => setCreating(true)} />
      </div>

      {canManageRoles ? null : (
        <p className="text-[12px] text-muted-foreground">
          Role di atas akun Anda tidak dapat ditetapkan, dan akun Anda sendiri tidak dapat
          dinonaktifkan atau dihapus.
        </p>
      )}
    </div>
  );
}