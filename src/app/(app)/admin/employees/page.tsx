import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ShieldCheck, UserCheck, Users, UserX } from "lucide-react";
import { requireRole } from "@/lib/dal/auth";
import { getEmployees } from "@/lib/dal/employees";
import { getActiveSchedules } from "@/lib/dal/settings";
import { hasRole, type Role } from "@/lib/attendance/time";
import {
  Surface,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceTitle,
} from "@/components/layout/primitives";
import { AdminFact, AdminHeader } from "@/components/admin/admin-header";
import { EmployeeRoster } from "@/components/admin/employee-roster";

export const metadata: Metadata = {
  title: "Karyawan",
};

function readParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : undefined;
}

/** Employee management. ADMIN and above. */
export default async function EmployeesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("ADMIN");
  const params = (await searchParams) ?? {};

  const roleParam = readParam(params.role);
  const allowed: Role[] = ["EMPLOYEE", "ADMIN", "SUPER_ADMIN"];
  const role = (allowed.includes(roleParam as Role) ? roleParam : "ALL") as Role | "ALL";
  const activeParam = readParam(params.active);
  const active = (
    ["ALL", "active", "inactive"].includes(activeParam ?? "") ? activeParam : "ALL"
  ) as "ALL" | "active" | "inactive";

  const [employees, schedules] = await Promise.all([
    getEmployees({ search: readParam(params.search), role, active }),
    getActiveSchedules(),
  ]);

  if (!hasRole(user.role, "ADMIN")) redirect("/admin/overview");

  const activeCount = employees.filter((employee) => employee.isActive).length;
  const adminCount = employees.filter((employee) => employee.role !== "EMPLOYEE").length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <AdminHeader
        icon={Users}
        eyebrow="Manajemen"
        title="Kelola Karyawan"
        description="Menonaktifkan akun langsung mengejar sesi yang sedang berjalan tanpa menghapus riwayat absensinya."
        meta={
          <>
            <AdminFact icon={Users} label="Sesuai filter" value={employees.length} tone="primary" />
            <AdminFact icon={UserCheck} label="Aktif" value={activeCount} tone="success" />
            <AdminFact
              icon={UserX}
              label="Nonaktif"
              value={employees.length - activeCount}
              tone={employees.length - activeCount > 0 ? "warning" : "neutral"}
            />
            <AdminFact icon={ShieldCheck} label="Admin" value={adminCount} />
          </>
        }
      />

      <Surface className="overflow-hidden">
        <SurfaceHeader>
          <SurfaceTitle>Daftar Karyawan</SurfaceTitle>
          <SurfaceDescription className="mt-1">
            Gunakan saklar untuk mengaktifkan atau menonaktifkan akun tanpa menghapus riwayatnya.
          </SurfaceDescription>
        </SurfaceHeader>

        <Suspense fallback={<p className="px-6 py-10 text-center text-[13px] text-muted-foreground">Memuat daftar karyawan…</p>}>
          <EmployeeRoster
            employees={employees.map((employee) => ({
              id: employee.id,
              name: employee.name,
              email: employee.email,
              employeeCode: employee.employeeCode,
              role: employee.role,
              department: employee.department,
              phone: employee.phone,
              scheduleId: employee.schedule?.id ?? null,
              isActive: employee.isActive,
              createdAt: employee.createdAt.toISOString(),
              scheduleName: employee.schedule?.name ?? null,
            }))}
            schedules={schedules.map((schedule) => ({
              id: schedule.id,
              name: schedule.name,
              workingDays: schedule.workingDays,
            }))}
            canManageRoles={hasRole(user.role, "SUPER_ADMIN")}
            currentUserId={user.id}
          />
        </Suspense>
      </Surface>
    </div>
  );
}